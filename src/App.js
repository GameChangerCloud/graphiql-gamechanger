import React, { Component } from 'react'
import GraphiQL from 'graphiql'
import GraphiQLExplorer from 'graphiql-explorer'
import { parse, getIntrospectionQuery, buildClientSchema } from 'graphql'
import { makeDefaultArg, getDefaultScalarArgValue } from './CustomArgs'
import 'graphiql/graphiql.css'
import './App.css'
import type { GraphQLSchema } from 'graphql'
import { Button, Modal, ModalHeader, ModalBody, Label, Col } from 'reactstrap'
import { Control, LocalForm, Errors } from 'react-redux-form'
import * as nomlParsing from './parser.js'
import checkReservedWords from './utils.js'
var generatedScript = require('./script.js')
var nomnoml = require('nomnoml')

var AWS = require('aws-sdk')

//Generator modal directives
const required = (val) => val && val.length
const maxLength = (len) => (val) => !val || val.length <= len
const minLength = (len) => (val) => val && val.length >= len
const lowerCase = (val) => val && val === val.toLowerCase()
const notAws = (val) => val && !val.toLowerCase().includes('aws')
const region = (val) => val && /^\w{2}-(west|north|south|east|northwest|northeast|southeast|southwest)-\d+$/gm.test(val)

function fetcher(api: String, token: String, params: Object): Object {
  return fetch(api, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: params,
  })
    .then(function(response) {
      return response.text()
    })
    .then(function(responseBody) {
      try {
        return JSON.parse(responseBody)
      } catch (e) {
        return responseBody
      }
    })
}

const DEFAULT_QUERY = `type Employe {
  id: ID!
  email: String!
  firstName: String
  lastName: String
  login: String!
  password: String!
  workInfo : Work
}

type Work {
  id: ID!
  job: String
  salary: String
  empl: [Employe]
}

type Query {
  Employes: [Employe]
}
`

type State = {
  schema: ?GraphQLSchema,
  query: string,
  explorerIsOpen: boolean,
  drag: boolean,
  api: string,
  token: string,
}

const handleGenerateScript = (jsonData, values) => {
  // Check if the scrips contains js reserved words
  if (checkReservedWords(jsonData)) {
    alert('Your schema contains javascript reserved words')
    return
  }

  //Generate the script
  var script = '#!/bin/bash\n\nschema="' + jsonData + '"\n\ntitle="' + values.title + '"\n\nframework="' + values.frontfw + '"\n\ndb="' + values.db + '"\n' + generatedScript.script

  const blob = new Blob([script], { type: 'application/sh' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = values.title + '.sh'
  link.href = url
  link.click()
}

class App extends Component<{}, State> {
  _graphiql: GraphiQL
  state = {
    schema: null,
    query: DEFAULT_QUERY,
    explorerIsOpen: false,
    drag: false,
    api: 'https://serve.onegraph.com/dynamic?app_id=c333eb5b-04b2-4709-9246-31e18db397e1',
    token: '',
  }

  implFetch = () => {
    fetcher(
      this.state.api,
      this.state.token,
      JSON.stringify({
        query: getIntrospectionQuery(),
      })
    ).then((result) => {
      const editor = this._graphiql.getQueryEditor()
      editor.setOption('extraKeys', {
        ...(editor.options.extraKeys || {}),
        'Shift-Alt-LeftClick': this._handleInspectOperation,
      })

      this.setState({ schema: buildClientSchema(result.data) })
    })
  }

  componentDidMount() {
    this.implFetch()
    this._showNomnoml(this.state.query)
  }

  _handleInspectOperation = (cm: any, mousePos: { line: Number, ch: Number }) => {
    const parsedQuery = parse(this.state.query || '')

    if (!parsedQuery) {
      console.error("Couldn't parse query document")
      return null
    }

    var token = cm.getTokenAt(mousePos)
    var start = { line: mousePos.line, ch: token.start }
    var end = { line: mousePos.line, ch: token.end }
    var relevantMousePos = {
      start: cm.indexFromPos(start),
      end: cm.indexFromPos(end),
    }

    var position = relevantMousePos

    var def = parsedQuery.definitions.find((definition) => {
      if (!definition.loc) {
        console.log('Missing location information for definition')
        return false
      }

      const { start, end } = definition.loc
      return start <= position.start && end >= position.end
    })

    if (!def) {
      console.error('Unable to find definition corresponding to mouse position')
      return null
    }

    var operationKind = def.kind === 'OperationDefinition' ? def.operation : def.kind === 'FragmentDefinition' ? 'fragment' : 'unknown'

    var operationName = def.kind === 'OperationDefinition' && !!def.name ? def.name.value : def.kind === 'FragmentDefinition' && !!def.name ? def.name.value : 'unknown'

    var selector = `.graphiql-explorer-root #${operationKind}-${operationName}`

    var el = document.querySelector(selector)
    el && el.scrollIntoView()
  }

  _handleEditQuery = (query: string): void => {
    this.setState({ query })
    this._showNomnoml(query)
  }

  _handleToggleExplorer = () => {
    this.setState({ explorerIsOpen: !this.state.explorerIsOpen })
  }

  handleSubmit(values) {
    this.toggleModal()
    console.log('Current State is: ' + JSON.stringify(values))
    handleGenerateScript(this.state.query, values)
  }

  handleApiSubmit(values) {
    this.toggleApiModal()
    var cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider({
      region: values['region'],
      accessKeyId: values['accessKeyId'],
      secretAccessKey: values['secretAccessKey'],
    })
    var params = {
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      ClientId: values['clientId'],
      UserPoolId: values['poolId'],
      AuthParameters: {
        USERNAME: 'admin@admin.fr',
        PASSWORD: 'password',
      },
      ContextData: {
        HttpHeaders: [
          {
            headerName: 'Content-Type',
            headerValue: 'application/x-amz-json-1.1',
          },
        ],
        IpAddress: '1.1.1.1',
        ServerName: '',
        ServerPath: '',
      },
    }
    var tokenId = ''
    cognitoidentityserviceprovider.adminInitiateAuth(params, function(err, data) {
      if (err) {
        console.log(err, err.stack)
        alert(err)
      } else tokenId = data['AuthenticationResult']['IdToken']
    })
    setTimeout(() => {
      console.log(tokenId)
      this.setState({ api: values['url'], token: tokenId })
      this.implFetch()
    }, 1000)
  }

  toggleModal = () => {
    this.setState({ isModalOpen: !this.state.isModalOpen })
  }
  toggleApiModal = () => {
    this.setState({ isApiModalOpen: !this.state.isApiModalOpen })
  }
  configureAWS = () => {
    this.toggleApiModal()
  }

  _getQuery = (query: string): void => {
    this.setState({ query: query['query'] })
    this.toggleModal()
  }
  _showNomnoml = (query: string): void => {
    //Parsing query to nomnoml
    var src = nomlParsing.parse(query)
    //if parsing fail
    if (src === '') return
    else {
      var tag = nomnoml.renderSvg(src)
      var div = document.getElementById('nomnoml')
      if (div.childNodes.length !== 0) div.childNodes[0].remove()
      div.insertAdjacentHTML('beforeend', tag)
    }
  }

  startDrag = (e) => {
    this.setState({ drag: true })
  }
  stopDrag = (e) => {
    this.setState({ drag: false })
  }
  onDrag = (e) => {
    if (this.state.drag) {
      const globalWidth = document.getElementById('root').offsetWidth
      const newX = document.getElementById('root').offsetWidth - e.clientX
      if (newX < globalWidth * 0.6 && newX > globalWidth / 10) document.getElementById('nomnoml').style.width = document.getElementById('root').offsetWidth - e.clientX - 110 + 'px'
    }
  }

  handleExecute = (value) => {
    var query = value['query']
    if (query.startsWith('query')) query = '{"query" : "' + query.replace(/\n/g, '').replace(/"/g, '\\"') + '"}'
    if (query.startsWith('mutation')) {
      var mutation = query.split(' ')
      mutation.shift()
      mutation.shift()
      mutation = mutation
        .join(' ')
        .replace(/\n/g, '')
        .replace(/"/g, '\\"')
      query = '{"query" : " mutation ' + mutation + '"}'
      // console.log(query);
    }
    const res = fetcher(this.state.api, this.state.token, query)
    return res
  }

  render() {
    const { query, schema } = this.state
    return (
      <div className="graphiql-container" onMouseMove={(event) => this.onDrag(event)} onMouseUp={(e) => this.stopDrag(e)}>
        <GraphiQLExplorer
          schema={schema}
          query={query}
          onEdit={this._handleEditQuery}
          onRunOperation={(operationName) => this._graphiql.handleRunQuery(operationName)}
          explorerIsOpen={this.state.explorerIsOpen}
          onToggleExplorer={this._handleToggleExplorer}
          getDefaultScalarArgValue={getDefaultScalarArgValue}
          makeDefaultArg={makeDefaultArg}
        />
        <GraphiQL ref={(ref) => (this._graphiql = ref)} fetcher={this.handleExecute} schema={schema} query={query} onEditQuery={this._handleEditQuery}>
          <GraphiQL.Toolbar>
            <GraphiQL.Button onClick={() => this._graphiql.handlePrettifyQuery()} label="Prettify" title="Prettify Query (Shift-Ctrl-P)" />
            <GraphiQL.Button onClick={() => this._graphiql.handleToggleHistory()} label="History" title="Show History" />
            <GraphiQL.Button onClick={this._handleToggleExplorer} label="Explorer" title="Toggle Explorer" />
            <GraphiQL.Button onClick={() => this._getQuery({ query })} label="Generate" title="Generate script for Gamechanger" />
            <GraphiQL.Button onClick={() => this.configureAWS()} label="Configure" title="Configure AWS" />
          </GraphiQL.Toolbar>
        </GraphiQL>
        <div id="drag" onMouseDown={(e) => this.startDrag(e)}></div>
        <div className="wrapNom">
          <div className="topBar"></div>
          <div id="nomnoml" className="nomnoml"></div>
        </div>

        <Modal isOpen={this.state.isModalOpen} toggle={this.toggleModal}>
          <ModalHeader toggle={this.toggleModal}>Choix des paramètres</ModalHeader>
          <ModalBody>
            <LocalForm onSubmit={(values) => this.handleSubmit(values)}>
              <div className="form-group">
                <Label htmlFor="title">Titre de l'application</Label>
                <Col>
                  <Control.text
                    model=".title"
                    id="title"
                    name="title"
                    placeholder="Titre"
                    className="form-control"
                    validators={{ required, minLength: minLength(2), maxLength: maxLength(15), notAws, lowerCase }}
                  />
                  <Errors
                    className="text-danger"
                    model=".title"
                    show="touched"
                    messages={{
                      required: 'Nécessaire ',
                      minLength: 'Doit être plus long que 2 caractères ',
                      maxLength: 'Doit être moins long que 15 caractères ',
                      notAws: 'Ne doit pas contenir le mot aws ',
                      lowerCase: 'Ne doit pas contenir de majuscules ',
                    }}
                  />
                </Col>
              </div>
              <div className="form-group">
                <Label htmlFor="frontfw">Client</Label>
                <Col>
                  <Control.select model=".frontfw" id="frontfw" name="frontfw" className="form-control" validators={{ required }}>
                    <option></option>
                    <option>Angular</option>
                  </Control.select>
                  <Errors
                    className="text-danger"
                    model=".frontfw"
                    show="touched"
                    messages={{
                      required: 'Nécessaire',
                    }}
                  />
                </Col>
              </div>
              <Button type="submit" value="submit" color="primary">
                Generate
              </Button>
            </LocalForm>
          </ModalBody>
        </Modal>
        <Modal isOpen={this.state.isApiModalOpen} toggle={this.toggleApiModal}>
          <ModalHeader toggle={this.toggleApiModal}>Configuring AWS</ModalHeader>
          <ModalBody>
            <LocalForm onSubmit={(values) => this.handleApiSubmit(values)}>
              <div className="form-group">
                <Col>
                  <Control.text model=".poolId" id="poolId" name="poolId" placeholder="AWS Pool ID" className="form-control" validators={{ required }} />
                  <Errors
                    className="text-danger"
                    model=".poolId"
                    show="touched"
                    messages={{
                      required: 'Nécessaire ',
                    }}
                  />
                </Col>
              </div>
              <div className="form-group">
                <Col>
                  <Control.text model=".clientId" id="clientId" name="clientId" placeholder="AWS Client ID" className="form-control" validators={{ required }} />
                  <Errors
                    className="text-danger"
                    model=".clientId"
                    show="touched"
                    messages={{
                      required: 'Nécessaire ',
                    }}
                  />
                </Col>
              </div>
              <div className="form-group">
                <Col>
                  <Control.text model=".region" id="region" name="region" placeholder="AWS region" className="form-control" validators={{ required, region }} />
                  <Errors
                    className="text-danger"
                    model=".region"
                    show="touched"
                    messages={{
                      required: 'Nécessaire ',
                      region: 'Doit être une region aws du type eu-west-1',
                    }}
                  />
                </Col>
              </div>
              <Button type="submit" value="submit" color="primary">
                Validate
              </Button>
            </LocalForm>
          </ModalBody>
        </Modal>
      </div>
    )
  }
}

export default App
