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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
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
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
require('dotenv').config(); // Changed this line
// Get RPC endpoint from env
var RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com';
function getWalletTokens() {
    return __awaiter(this, void 0, void 0, function () {
        var connection, walletPublicKey, tokenAccounts, firstTwoTokens, _i, firstTwoTokens_1, account, tokenData, mintInfo, metadata, error_1, error_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 9, , 10]);
                    connection = new web3_js_1.Connection(RPC_ENDPOINT);
                    // Get public key from env
                    if (!process.env.BUYER_PUBLIC_KEY) {
                        throw new Error('BUYER_PUBLIC_KEY not found in environment variables');
                    }
                    walletPublicKey = new web3_js_1.PublicKey(process.env.BUYER_PUBLIC_KEY);
                    console.log('🔗 Connected to:', RPC_ENDPOINT);
                    console.log('👛 Wallet:', walletPublicKey.toBase58());
                    console.log('🔍 Fetching wallet tokens...\n');
                    return [4 /*yield*/, connection.getParsedTokenAccountsByOwner(walletPublicKey, { programId: spl_token_1.TOKEN_PROGRAM_ID })];
                case 1:
                    tokenAccounts = _b.sent();
                    if (tokenAccounts.value.length === 0) {
                        console.log('❌ No tokens found in wallet');
                        return [2 /*return*/];
                    }
                    firstTwoTokens = tokenAccounts.value.slice(0, 2);
                    _i = 0, firstTwoTokens_1 = firstTwoTokens;
                    _b.label = 2;
                case 2:
                    if (!(_i < firstTwoTokens_1.length)) return [3 /*break*/, 8];
                    account = firstTwoTokens_1[_i];
                    tokenData = {
                        mint: account.account.data.parsed.info.mint,
                        amount: account.account.data.parsed.info.tokenAmount.amount,
                        decimals: account.account.data.parsed.info.tokenAmount.decimals,
                    };
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, connection.getParsedAccountInfo(new web3_js_1.PublicKey(tokenData.mint))];
                case 4:
                    mintInfo = _b.sent();
                    if (((_a = mintInfo.value) === null || _a === void 0 ? void 0 : _a.data) &&
                        typeof mintInfo.value.data !== 'string' &&
                        'parsed' in mintInfo.value.data) {
                        metadata = mintInfo.value.data.parsed.info;
                        tokenData.name = metadata.name;
                        tokenData.symbol = metadata.symbol;
                    }
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _b.sent();
                    console.log("\u26A0\uFE0F Could not fetch metadata for token: ".concat(tokenData.mint));
                    return [3 /*break*/, 6];
                case 6:
                    // Print token info
                    console.log('💎 Token Information:');
                    console.log('------------------------------------------');
                    console.log("Mint Address: ".concat(tokenData.mint));
                    console.log("Amount: ".concat(tokenData.amount));
                    console.log("Decimals: ".concat(tokenData.decimals));
                    if (tokenData.name)
                        console.log("Name: ".concat(tokenData.name));
                    if (tokenData.symbol)
                        console.log("Symbol: ".concat(tokenData.symbol));
                    console.log('------------------------------------------\n');
                    _b.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_2 = _b.sent();
                    console.error('❌ Error:', error_2);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
// Run the function
getWalletTokens();
