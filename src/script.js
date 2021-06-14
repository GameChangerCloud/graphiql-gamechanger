export const script = `
UNAME=$(uname)

if [ "$UNAME" == "Linux" ] ; then
	echo "==> Running on Linux..."
  sedOptions='-i'
elif [ "$UNAME" == "Darwin" ] ; then
	echo "==> Running on Mac OS"
  sedOptions='-i ""'
elif [[ "$UNAME" == CYGWIN* || "$UNAME" == MINGW* ]] ; then
	echo "==> Running on Windows"
  sedOptions='-i'
fi

echo "==> Checking requirements...."

required=("yo" "terraform" "aws" "react-deploy")
yoV=$(yo --version)
terraformV=$(echo "\`terraform --version\`" | head -n 1 | cut -d'v' -f 2)
awsV=$(echo "\`aws --version\`" | cut -d'/' -f 2 | cut -d' ' -f 1)
rdV=$(react-deploy --version)

actualVersions=($yoV $terraformV $awsV $rdV)
requiredVersions=("3.1.1" "0.14.7" "2.1.29" "0.0.17")

for i in $( seq 0 $((\${#required[@]}-1)) )
do
  if [[ \${actualVersions[i]} < \${requiredVersions[i]} ]]; then
    echo "Mauvaise version de \${required[i]}"
    exit 1
  else
    echo "V - \${required[i]} is present"
  fi
done

string=$(yo -h &) 
if [[ $string != *"Aws Server Gamechanger"* ]] && [[ $string != *"React Client Gamechanger"* ]]; then
  echo "X - AWS Server Gamechanger and React Client Gamechanger not found"
  exit 1
else 
  echo "V - AWS Server Gamechanger and React Client Gamechanger generators installed"
fi

accessKey=$(aws configure get default.aws_secret_access_key)
keyId=$(aws configure get default.aws_access_key_id)
if [ $accessKey == "" ] || [ $keyId == "" ]; then
  echo "X - AWS not well configured"
  exit 1
else 
  echo "V - AWS configured"
fi
export AWS_DEFAULT_REGION=$(aws configure get region --profile default)
if [ -z $AWS_DEFAULT_REGION ]; then
  echo "AWS region not set"
  exit 1
else
  echo "AWS default region : $AWS_DEFAULT_REGION"
fi

echo "==> Requirements all ready..."

echo "==> Generating graphql schema..."
echo "$schema" > schema.graphql
btitle=$title-back
echo "==> Generating $btitle server using yeoman..."
rm -rf $btitle
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
echo "==> Generating AWS ressource..."
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

response=$(curl -m 90 -X POST -H "Authorization: $idToken" -H "Content-Type: application/json" -d '{"initTable": "init"}' "$url")
echo "$response"
if [ "$response" != '{"statusCode":200,"body":"\\"Init done\\""}' ]
then
  echo "Failed... Stopping initTable generation..."
  exit 1
fi

if [ "$db" = "Oui" ]
then
  echo "==> Adding fakes data..."
  response=$(curl -m 90 -X POST -H "Authorization: $idToken" -H "Content-Type: application/json" -d '{"fillTable": "fill"}' "$url")
  echo "$response"
  if [ "$response" != '{"statusCode":200,"body":"\\"Fill done\\""}' ]
  then 
    echo "Stopping fillTable generation..."
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
    rm -rf $rtitle
    npx create-react-app $rtitle
    cd $rtitle
    echo "==> Generating React front with yeoman..."
    yo react-client-gamechanger ../schema.graphql
    echo "==> Launching npm install..."
    npm install
    echo "==> Putting api url '$url' in src/constant/index.js..."
    sed $sedOptions "s|herokuPrefix + ''|'$url'|g" src/constants/index.js


    echo "==> Putting values for AWS in src/config/app-config.json..."
    frontValues=$(awk -F : '{print  $2}' ../$btitle/terraform/front.txt)
    echo $frontValues
    # Transform as array
    front=($frontValues)
    userPoolId=\${front[0]}
    clientId=\${front[1]}
    echo "User pool id : "$userPoolId " Client id : "$clientId " Domain : "\${front[2]}
    sed $sedOptions "s/\\"region\\": \\"\\"/\\"region\\": \\"$AWS_DEFAULT_REGION\\"/g" src/config/app-config.json
    sed $sedOptions "s/\\"userPool\\": \\"\\"/\\"userPool\\": \\"$userPoolId\\"/g" src/config/app-config.json
    sed $sedOptions "s/\\"userPoolBaseUri\\": \\"\\"/\\"userPoolBaseUri\\": \\"https:\\/\\/\${front[2]}.auth.eu-west-1.amazoncognito.com\\"/g" src/config/app-config.json
    sed $sedOptions "s/\\"clientId\\": \\"\\"/\\"clientId\\": \\"$clientId\\"/g" src/config/app-config.json

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
    # aws cognito-idp update-user-pool-client --user-pool-id $userPoolId --client-id $clientId --callback-urls $ProductionUrl --logout-urls $LogoutUrl --region eu-west-1 --supported-identity-providers "COGNITO" --allowed-o-auth-flows "code" "implicit" --allowed-o-auth-scopes "phone" "email" "openid" "profile" "aws.cognito.signin.user.admin" --allowed-o-auth-flows-user-pool-client
    cd ../../$btitle/terraform/
    sed $sedOptions "s|callback_urls .*|callback_urls = [\\"$ProductionUrl\\"]|g" cognito.tf
    sed $sedOptions "s|logout_urls .*|logout_urls = [\\"$LogoutUrl\\"]|g" cognito.tf
    yes "yes" | terraform apply -var-file="terraform.tfvar" -target=aws_cognito_user_pool_client.client

    cd ../../$rtitle/terraform
    sed $sedOptions "s|\\"callbackUri\\": \\"\\"|\\"callbackUri\\": \\"$ProductionUrl\\"|g" ../src/config/app-config.json
    sed $sedOptions "s|\\"signoutUri\\": \\"\\"|\\"signoutUri\\": \\"$LogoutUrl\\"|g" ../src/config/app-config.json

    echo "==> Putting AWS access infos in deploy.js..."
    sed $sedOptions "s|region: ''|region: '$AWS_DEFAULT_REGION'|g" ../deploy.js
    sed $sedOptions "s|accessKeyId: ''|accessKeyId: '$keyId'|g" ../deploy.js
    sed $sedOptions "s|secretAccessKey: ''|secretAccessKey: '$accessKey'|g" ../deploy.js

    echo "==> Building app..."
    cd ..
    npm run build

    echo "==> Production deployement..."
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
