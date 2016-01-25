'use strict';

const MAX_MESSAGES = 10;

const qs = require('qs');
const http = require('http');
const httpServer = http.createServer(function(req, res) {
  res.writeHead(404);
  res.end();
});

httpServer.listen(8081, function() {
  console.log('Server is listening on port 8081');
});

const WebSocketServer = require('websocket').server;
const wsServer = new WebSocketServer({ httpServer });

const connections = new Set();
const conversations = new Map();

wsServer.on('request', (req) => {
  const connection = req.accept('echo-protocol', req.origin);
  connections.add(connection);

  let conversation;
  let conversationId;
  let displayName;

  connection.on('message', (message) => {
    let args, command;

    try {
      let data = JSON.parse(message.utf8Data);
      command = data.command;
      args = qs.parse(data.args);
    } catch(e) {
      connection.send(JSON.stringify({
        type: 'invalid-message',
        body: message
      }));

      return console.info('Received malformed message');
    }

    switch(command) {
      /**
       * Initialize a client's session by adding them to
       * their specified conversation ID by their display name
       */
      case 'join-conversation':
        displayName = args.displayName;
        conversationId = args.conversationId;

        conversation = conversations.get(conversationId);
        if (!conversation) {
          conversation = { messages: [] };
          conversations.set(conversationId, conversation);
        }

        connection.send(JSON.stringify({ type: 'conversation-joined' }));
        break;

      /**
       * Send a message from the client to the conversation
       */
      case 'send-message':
        const msg = displayName + ': ' + args.text;

        conversation.messages.push(msg);
        if (conversation.messages.length > MAX_MESSAGES) {
          conversation.messages.shift();
        }

        connections.forEach((connection) => {
          connection.send(JSON.stringify({
            type: 'new-message',
            body: msg
          }));
        });

        break;

      /**
       * Get a list of stored messages of the conversation.
       * Limited to 10.
       */
      case 'get-messages':
        connection.send(JSON.stringify({
          type: 'message-list',
          body: conversation.messages.map(encodeURIComponent).join(',')
        }));

        break;

      /**
       * An invalid command was sent.
       */
      default:
        connection.send(JSON.stringify({
          type: 'unknown-command',
          body: command
        }));

        break;
    }
  });

  connection.on('close', () => connections.delete(connection));
});

