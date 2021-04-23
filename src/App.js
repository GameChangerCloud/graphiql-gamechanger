// @flow

import React, { Component } from "react";
import ReactDOM from "react-dom";
import GraphiQL from "graphiql";
import GraphiQLExplorer from "graphiql-explorer";
import { /*buildClientSchema,*/ getIntrospectionQuery, parse } from "graphql";
import { makeDefaultArg, getDefaultScalarArgValue } from "./CustomArgs";
import "graphiql/graphiql.css";
import "./App.css";
import type { GraphQLSchema } from "graphql";
// import * as fs from 'fs';
import { Button, Modal, ModalHeader, ModalBody, Label, Col} from 'reactstrap';
import { Control, LocalForm, Errors } from 'react-redux-form';
var generatedScript = require('./script.js');

var nomnoml = require('nomnoml');

const required = (val) => val && val.length;
const maxLength = (len) => (val) => !(val) || (val.length <= len);
const minLength = (len) => (val) => val && (val.length >= len); 	

// const { exec } = require('child_process');

function fetcher(params: Object): Object {
  return fetch(
    "https://serve.onegraph.com/dynamic?app_id=c333eb5b-04b2-4709-9246-31e18db397e1",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    }
  )
    .then(function(response) {
      return response.text();
    })
    .then(function(responseBody) {
      try {
        return JSON.parse(responseBody);
      } catch (e) {
        return responseBody;
      }
    });
}

const DEFAULT_QUERY = `type User {
  id: ID!
  username: String
  firstname: String
  lastname: String
  fullname: String
  name: String @deprecated
}

type Stat {
  id: ID!
  views: Int
  likes: Int
  retweets: Int
  responses: Int
}

type Notification {
  id: ID!
  type: String
}

type Meta {
  id: ID!
  count: Int
}`;

type State = {
  schema: ?GraphQLSchema,
  query: string,
  explorerIsOpen: boolean
};
const handleGenerateScript = (jsonData,values) => {
//   const fileData = JSON.stringify(jsonData);
	var script = "#!/bin/bash\n\n" +
		"schema=\"" + jsonData + "\"\n\n" +
		"title=\"" + values.title + "\"\n\n" +
		"framework=\"" + values.frontfw +"\"\n\n" +
		"db=\"" + values.db + "\"\n" +
    generatedScript.script

  const blob = new Blob([script], {type: "application/sh"});
//   console.log(blob)
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'generatedSchema.sh';
  link.href = url;
  link.click();
}

class App extends Component<{}, State> {
  _graphiql: GraphiQL;
  state = { 
    schema: null, 
    query: DEFAULT_QUERY, 
    explorerIsOpen: true ,
  };


  componentDidMount() {
    fetcher({
      query: getIntrospectionQuery()
    }).then(result => {
      const editor = this._graphiql.getQueryEditor();
      editor.setOption("extraKeys", {
        ...(editor.options.extraKeys || {}),
        "Shift-Alt-LeftClick": this._handleInspectOperation
      });

      // this.setState({ schema: buildClientSchema(result.data) });
    });
  }

  _handleInspectOperation = (
    cm: any,
    mousePos: { line: Number, ch: Number }
  ) => {
    const parsedQuery = parse(this.state.query || "");

    if (!parsedQuery) {
      console.error("Couldn't parse query document");
      return null;
    }

    var token = cm.getTokenAt(mousePos);
    var start = { line: mousePos.line, ch: token.start };
    var end = { line: mousePos.line, ch: token.end };
    var relevantMousePos = {
      start: cm.indexFromPos(start),
      end: cm.indexFromPos(end)
    };

    var position = relevantMousePos;

    var def = parsedQuery.definitions.find(definition => {
      if (!definition.loc) {
        console.log("Missing location information for definition");
        return false;
      }

      const { start, end } = definition.loc;
      return start <= position.start && end >= position.end;
    });

    if (!def) {
      console.error(
        "Unable to find definition corresponding to mouse position"
      );
      return null;
    }

    var operationKind =
      def.kind === "OperationDefinition"
        ? def.operation
        : def.kind === "FragmentDefinition"
        ? "fragment"
        : "unknown";

    var operationName =
      def.kind === "OperationDefinition" && !!def.name
        ? def.name.value
        : def.kind === "FragmentDefinition" && !!def.name
        ? def.name.value
        : "unknown";

    var selector = `.graphiql-explorer-root #${operationKind}-${operationName}`;

    var el = document.querySelector(selector);
    el && el.scrollIntoView();
  };

	_handleEditQuery = (query: string): void => this.setState({ query });

	_handleToggleExplorer = () => {
		this.setState({ explorerIsOpen: !this.state.explorerIsOpen });
	};

	handleSubmit(values) {
    this.toggleModal();
    console.log('Current State is: ' + JSON.stringify(values));
    alert('Current State is: ' + JSON.stringify(values));
		handleGenerateScript(this.state.query,values)
  }

  toggleModal = () => {
      this.setState({ isModalOpen: !this.state.isModalOpen});
  };
  _getQuery = (query: string): void => {
    // console.log(query);
    // handleGenerateScript(query["query"])
    this.setState({query: query["query"]})
    this.toggleModal()
  }
  _showNomnoml = (query : string): void => {
    var src = '[nomnoml] is -> [awesome]';
    // console.log(nomnoml.renderSvg(src));
    var tag = nomnoml.renderSvg(src)
    var div = document.getElementById("nom");
    div.insertAdjacentHTML('beforeend',tag) 
  }

  render() {
    const { query, schema } = this.state;
    return (
      <div className="graphiql-container">
        <GraphiQLExplorer
          schema={schema}
          query={query}
          onEdit={this._handleEditQuery}
          onRunOperation={operationName =>
            this._graphiql.handleRunQuery(operationName)
          }
          explorerIsOpen={this.state.explorerIsOpen}
          onToggleExplorer={this._handleToggleExplorer}
          getDefaultScalarArgValue={getDefaultScalarArgValue}
          makeDefaultArg={makeDefaultArg}
        />
        <GraphiQL
          ref={ref => (this._graphiql = ref)}
          fetcher={fetcher}
          schema={schema}
          query={query}
          onEditQuery={this._handleEditQuery}
        >
          <GraphiQL.Toolbar>
            <GraphiQL.Button
              onClick={() => this._graphiql.handlePrettifyQuery()}
              label="Prettify"
              title="Prettify Query (Shift-Ctrl-P)"
            />
            <GraphiQL.Button
              onClick={() => this._graphiql.handleToggleHistory()}
              label="History"
              title="Show History"
            />
            <GraphiQL.Button
              onClick={this._handleToggleExplorer}
              label="Explorer"
              title="Toggle Explorer"
            />
            <GraphiQL.Button
              onClick={() => this._getQuery({query})}
              label="Generate"
              title="Generate script for Gamechanger"
            />
            <GraphiQL.Button
              onClick={() => this._showNomnoml({query})}
              label="Nomnoml"
              title="Show Nomnoml"
            />
          </GraphiQL.Toolbar>
        </GraphiQL>

        <Modal isOpen={this.state.isModalOpen} toggle={this.toggleModal}>
          <ModalHeader toggle={this.toggleModal}>Choix des paramètres</ModalHeader>
          <ModalBody>
            <LocalForm onSubmit={(values) => this.handleSubmit(values)}>
              <div className="form-group">
                <Label htmlFor="title">Titre de l'application</Label>
                <Col>
                  <Control.text model=".title" id="title" name="title"
                    placeholder="Titre" className="form-control" 
                    validators={{required,minLength: minLength(2), maxLength: maxLength(15)}}/>
                  <Errors
                    className="text-danger"
                    model=".title"
                    show="touched"
                    messages={{
                        required: 'Nécessaire ',
                        minLength: 'Doit être plus long que 2 caractères',
                        maxLength: 'Doit être moins long que 15 caractères'
                    }}
                  />
                </Col>
              </div>
              <div className="form-group">
                <Label htmlFor="frontfw">Front</Label>
                <Col>
                  <Control.select model=".frontfw" id="frontfw" name="frontfw"
                    className="form-control" validators={{required}}>>
                    <option></option>
                    <option>Angular</option>
                    <option>Ember</option>
                    <option>React</option>
                    <option>Vue</option>
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
              <div className="form-group">
                <Label htmlFor="db">Jeu de données inclus</Label>
                <Col>
                  <Control.select model=".db" id="db" name="db"
                    className="form-control" validators={{required}}>
                    <option></option>
                    <option>Oui</option>
                    <option>Non</option>
                  </Control.select>
                  <Errors
                    className="text-danger"
                    model=".db"
                    show="touched"
                    messages={{
                      required: 'Nécessaire',
                    }}
                    />
                </Col>
              </div>
              <Button type="submit" value="submit" color="primary">Generate</Button>

            </LocalForm>
          </ModalBody>
        </Modal>
      </div>
    );
  }
}

export default App;
