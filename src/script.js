export const script = `
echo "==> Generating graphql schema..."
echo "$schema" > schema.graphql
btitle=$title-back
echo "==> Generating $btitle server using yeoman..."
yes "" | yo aws-server-gamechanger $btitle schema.graphql

cd $btitle/terraform
# On suppose que l'utilisateur a fait un aws configure avec ses ID + Access Key + region eu-west-1 + json
echo "==> Initializing terraform..."
init=$(terraform init)
if [[ $init == *"Terraform has been successfully initialized"* ]]
then
  echo "$init"
else
  echo "$init"
  exit 1
fi
echo "==> Generating aws ressource..."
yes "yes" | terraform apply -var-file="terraform.tfvar"

# Getting poolID and clientID from cognito.txt
echo "==> Getting cognito IDs..."
cognitoValues=$(awk -F : '{print  $2}' cognito.txt)
# Transform as array
cognito=($cognitoValues)

poolId=\${cognito[0]}
echo "poolId : "$poolId
clientId=\${cognito[1]}
echo "clientId : "$clientId

echo "==> Getting token from cognito..."
cognitoIdp=$(aws cognito-idp admin-initiate-auth --user-pool-id $poolId --client-id $clientId --auth-flow ADMIN_NO_SRP_AUTH --auth-parameters USERNAME=admin@admin.fr,PASSWORD=password)
cognitoTmp=($cognitoIdp)
for i in "\${!cognitoTmp[@]}"; do 
  if [ "\${cognitoTmp[$i]}" = '"IdToken":' ]
  then
    idToken=$(echo \${cognitoTmp[i+1]} | cut -d'"' -f2)
  fi
done

echo "Cognito token : "$idToken

echo "==> Getting endpoint url..."
while IFS= read -r line; do url=$line; done < url.txt

echo "endpoint url : "$url

response=$(curl -X POST -H "Authorization: $idToken" -H "Content-Type: application/json" -d '{"initTable": "init"}' "$url")
echo "$response"
if [ "$response" != '{"statusCode":200,"body":"\\"Init done\\""}' ]
then
  echo "Stoping generation..." 
  exit 1
fi

if [ "$db" = "Oui" ]
then
  echo "==> Adding fakes data..."
  response=$(curl -X POST -H "Authorization: $idToken" -H "Content-Type: application/json" -d '{"fillTable": "fill"}' "$url")
  echo "$response"
  if [ "$response" != '{"statusCode":200,"body":"\\"Fill done\\""}' ]
  then 
    echo "Stoping generation..."
    exit 1
  fi
fi

cd ../..

echo "****************************"
echo "******** FRONT PART ********"
echo "****************************"

case $framework in

  "React")
    rtitle=$title-front-react
    echo "==> Generating React app $rtitle..."
    npx create-react-app $rtitle
    cd $rtitle
    echo "==> Generating React front with yeoman..."
    yo react-client-gamechanger ../schema.graphql
    npm install
    APIurl="herokuPrefix + '$url'"
    echo "==> Putting api url '$APIurl' in src/constant/index.js..."
    sed -i "s|herokuPrefix + ''|$APIurl|g" src/constants/index.js


    echo "==> Putting values for aws in src/config/app-config.json..."
    frontValues=$(awk -F : '{print  $2}' ../$btitle/terraform/front.txt)
    echo $frontValues
    # Transform as array
    front=($frontValues)
    userPoolId=\${front[0]}
    clientId=\${front[1]}
    echo "User pool id : "$userPoolId " Client id : "$clientId " Domain : "\${front[2]}
    sed -i "s/\\"userPool\\": \\"\\"/\\"userPool\\": \\"$userPoolId\\"/g" src/config/app-config.json
    sed -i "s/\\"userPoolBaseUri\\": \\"\\"/\\"userPoolBaseUri\\": \\"https:\\/\\/\${front[2]}.auth.eu-west-1.amazoncognito.com\\"/g" src/config/app-config.json
    sed -i "s/\\"clientId\\": \\"\\"/\\"clientId\\": \\"$clientId\\"/g" src/config/app-config.json

    echo "==> Applying terraform..."
    cd terraform
    init=$(terraform init)
    if [[ $init == *"Terraform has been successfully initialized"* ]]
    then
      echo "$init"
    else
      echo "$init"
      exit 1
    fi
    yes "yes" | terraform apply

    echo "==> Getting url from ids.txt..."
    idsValues=$(awk -F : '{print $1 $2}' ids.txt)
    # Transform as array
    ids=($idsValues)
    for i in "\${!ids[@]}"; do 
        if [ "\${ids[$i]}" = 'URL_PRODUCTION' ]
        then
        ProductionUrl=https://\${ids[$i+1]}/callback
        LogoutUrl=https://\${ids[$i+1]}
        fi
        if [ "\${ids[$i]}" = 'URL_STAGING' ]
        then
        StagingUrl=https://\${ids[$i+1]}/callback
        # LogoutUrl=https://\${ids[$i+1]}
        fi
    done

    echo "==> Updating callback : '$ProductionUrl' and logout url : '$LogoutUrl'..."
    aws cognito-idp update-user-pool-client --user-pool-id $userPoolId --client-id $clientId --callback-urls $ProductionUrl --logout-urls $LogoutUrl --region eu-west-1 --supported-identity-providers "COGNITO" --allowed-o-auth-flows "code" "implicit" --allowed-o-auth-scopes "phone" "email" "openid" "profile" "aws.cognito.signin.user.admin" --allowed-o-auth-flows-user-pool-client

    sed -i "s|\\"callbackUri\\": \\"\\"|\\"callbackUri\\": \\"$ProductionUrl\\"|g" ../src/config/app-config.json
    sed -i "s|\\"signoutUri\\": \\"\\"|\\"signoutUri\\": \\"$LogoutUrl\\"|g" ../src/config/app-config.json

    echo "==> Getting aws credentials..."
    awsCredentials=$(awk '{print $1" "$3}' ~/.aws/credentials)
    credentials=($awsCredentials)
    for i in "\${!credentials[@]}"; do 
        if [ "\${credentials[$i]}" = 'aws_access_key_id' ]
        then
        echo "Key id : "\${credentials[$i+1]}
        keyId=\${credentials[$i+1]}
        fi
        if [ "\${credentials[$i]}" = 'aws_secret_access_key' ]
        then
        echo "Access key : "\${credentials[$i+1]}
        accessKey=\${credentials[$i+1]}
        fi
    done

    echo "==> Putting aws access infos in deploy.js..."
    sed -i "s/accessKeyId: ''/accessKeyId: '$keyId'/g" ../deploy.js
    sed -i "s/secretAccessKey: ''/secretAccessKey: '$accessKey'/g" ../deploy.js

    echo "==> Building app..."
    cd ..
    npm run build

    echo "==> Deploiement en production..."
    react-deploy deploy production

    echo "Finished, available at $LogoutUrl"
    ;;
  "Ember")
    echo "Generating Ember front..."
    ;;
  "Vue")
    echo "Generating Vue front..."
    ;;

  *)
    echo "ERROR no framework"
    ;;
esac

`