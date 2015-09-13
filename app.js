var Hapi = require('hapi');
var request = require('request');
var url = require('url');

var CLIENT_ID = process.env['CLIENT_ID'];
var CLIENT_SECRET = process.env['CLIENT_SECRET'];
var AUTHORIZATION_URI = url.format({
    protocol: 'https',
    hostname: 'login.uber.com',
    pathname: '/oauth/authorize',
    query: {
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: 'http://localhost:3000/submit',
        scope: 'profile history_lite'
    }
});

var server = new Hapi.Server();
server.connection({port: 3000});
server.state('accessToken', {
    ttl: 30 * 24 * 60 * 60 * 1000 // 30 days
});

server.route({
    method: 'GET',
    path: '/',
    handler: function(req, reply) {
        reply.redirect('/history');
    }
});

server.route({
    method: 'GET',
    path: '/auth',
    handler: function(req, reply) {
        reply.redirect(AUTHORIZATION_URI);
    }
});

server.route({
    method: 'GET',
    path: '/submit',
    handler: function(req, reply) {
        request({
            method: 'POST',
            url: 'https://login.uber.com/oauth/token',
            form: {
                client_secret: CLIENT_SECRET,
                client_id: CLIENT_ID,
                grant_type: 'authorization_code',
                redirect_uri: 'http://localhost:3000/submit',
                code: req.query.code
            }
        }, saveToken);

        function saveToken(err, result, body) {
            reply
                .redirect('/history')
                .state('accessToken', safeJSONParse(body).access_token);
        }
    }
});

server.route({
    method: 'GET',
    path: '/history',
    handler: function(req, reply) {
        var accessToken = req.state.accessToken;
        if (!accessToken) {
            return reply.redirect('/auth');
        }
        request({
            headers: {
                Authorization: 'Bearer ' + accessToken
            },
            url: 'https://api.uber.com/v1.1/history'
        }, function(err, response, body) {
            if (response.statusCode === 401) {
                reply.redirect('/auth');
            } else {
                reply(body);
            }
        });
    }
});

server.start(function(argument) {
    console.log('Server running at: ' + server.info.uri);
});

function safeJSONParse(object) {
    try {
        return JSON.parse(object);
    } catch (e) {
        return {};
    }
}
