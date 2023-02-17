This project use [OneGraph](https://www.onegraph.com)'s open source [GraphiQL explorer](https://github.com/OneGraph/graphiql-explorer) in order to edit GraphQL schema and generate using gamechanger.

# Quickstart

Install dependencies:

```
npm install
# or
yarn install
```

Start the server:

```
npm run start
# or
yarn start
```

Your browser will automatically open to http://localhost:3000 with the explorer open.

# Requirement for the script

- schematics cli
- [terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli)
- [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html) (with an AWS Account well configured with `aws configure` )
- react deploy cli

```
npm install -g react-deploy-cli
```

# Usage

## Editor and Generator

Edit your GraphQL schema in the area

(Inserer gif d'edition)

Then click on generate and fill the informations

You will download a **bash** script file which will generate your back and front named _title_-back and _title_-front-_frontFramework_. This will also deploy them on aws

## Endpoint

To change the endpoint, click on **Configure** button and fill with your informations. Then, in the explorer tab you can generate query by selecting wanted data.
