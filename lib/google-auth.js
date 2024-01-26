"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOauth2Client = exports.getTokens = void 0;
var http = require('http');
var opn = require('opn');
var google = require('googleapis').google;
var CLIENT_ID = '290430285327-un8po3uie98phhnv6l0f68jll25mnpko.apps.googleusercontent.com';
var CLIENT_SECRET = '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';
var REDIRECT_URI = 'http://localhost:3000/oauth2callback';
var SCOPES = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/userinfo.profile'
];
function getTokens() {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
                    var authUrl = oauth2Client.generateAuthUrl({
                        access_type: 'offline',
                        scope: SCOPES
                    });
                    var server = http.createServer(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var qs, code, tokens, err_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    if (!(req.url.indexOf('/oauth2callback') > -1)) return [3 /*break*/, 2];
                                    qs = new URL(req.url, 'http://localhost:3000').searchParams;
                                    code = qs.get('code');
                                    return [4 /*yield*/, oauth2Client.getToken(code)];
                                case 1:
                                    tokens = (_a.sent()).tokens;
                                    resolve(tokens);
                                    server.close();
                                    console.log('Authorization successful! You may now close the browser tab.');
                                    res.end('Authorization successful! You may now close the browser tab.');
                                    return [3 /*break*/, 3];
                                case 2:
                                    res.end('Hello World!');
                                    _a.label = 3;
                                case 3: return [3 /*break*/, 5];
                                case 4:
                                    err_1 = _a.sent();
                                    console.error(err_1);
                                    reject(err_1);
                                    res.end('Error occurred during authorization. Please try again.');
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    server.listen(3000, function () {
                        opn(authUrl, { wait: false });
                        console.log("Please visit this URL to authorize the application: ".concat(authUrl));
                    });
                })];
        });
    });
}
exports.getTokens = getTokens;
function getOauth2Client(tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var oauth2Client;
        return __generator(this, function (_a) {
            oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
            oauth2Client.setCredentials(tokens);
            return [2 /*return*/, oauth2Client];
        });
    });
}
exports.getOauth2Client = getOauth2Client;
