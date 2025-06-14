"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = void 0;
exports.getSession = getSession;
exports.setupAuth = setupAuth;
const passport_1 = __importDefault(require("passport"));
const passport_local_1 = require("passport-local");
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const storage_1 = require("./storage");
function getSession() {
    const sessionTtl = 7 * 24 * 60 * 60 * 1000;
    const pgStore = (0, connect_pg_simple_1.default)(express_session_1.default);
    const sessionStore = new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: false,
        ttl: sessionTtl,
        tableName: "sessions",
    });
    return (0, express_session_1.default)({
        secret: process.env.SESSION_SECRET || 'gps-tracker-secret-key',
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: sessionTtl,
        },
    });
}
async function setupAuth(app) {
    app.use(getSession());
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    passport_1.default.use(new passport_local_1.Strategy({
        usernameField: 'email',
        passwordField: 'password'
    }, async (email, password, done) => {
        try {
            const user = await storage_1.storage.getUserByEmail(email);
            if (!user) {
                return done(null, false, { message: 'Email non trovato' });
            }
            const isValid = await bcrypt_1.default.compare(password, user.passwordHash);
            if (!isValid) {
                return done(null, false, { message: 'Password non corretta' });
            }
            return done(null, user);
        }
        catch (error) {
            return done(error);
        }
    }));
    passport_1.default.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport_1.default.deserializeUser(async (id, done) => {
        try {
            const user = await storage_1.storage.getUser(id);
            done(null, user);
        }
        catch (error) {
            done(error);
        }
    });
    app.post("/api/auth/login", (req, res, next) => {
        passport_1.default.authenticate('local', (err, user, info) => {
            if (err) {
                return res.status(500).json({ error: 'Errore del server' });
            }
            if (!user) {
                return res.status(401).json({
                    error: info?.message || 'Email o password non corretti'
                });
            }
            req.login(user, (loginErr) => {
                if (loginErr) {
                    return res.status(500).json({ error: 'Errore durante il login' });
                }
                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role
                    }
                });
            });
        })(req, res, next);
    });
    app.post("/api/auth/register", async (req, res) => {
        try {
            const { email, password, firstName, lastName } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email e password richiesti' });
            }
            const existingUser = await storage_1.storage.getUserByEmail(email);
            if (existingUser) {
                return res.status(409).json({ error: 'Email già registrata' });
            }
            const passwordHash = await bcrypt_1.default.hash(password, 10);
            const user = await storage_1.storage.createUser({
                email,
                passwordHash,
                firstName: firstName || null,
                lastName: lastName || null,
                role: 'user'
            });
            req.login(user, (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Errore durante il login automatico' });
                }
                res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
            });
        }
        catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Errore durante la registrazione' });
        }
    });
    app.post("/api/auth/logout", (req, res) => {
        req.logout((err) => {
            if (err) {
                return res.status(500).json({ error: 'Errore durante il logout' });
            }
            res.json({ success: true });
        });
    });
    app.get("/api/auth/user", (req, res) => {
        if (req.isAuthenticated()) {
            const user = req.user;
            res.json({
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            });
        }
        else {
            res.status(401).json({ error: 'Non autenticato' });
        }
    });
}
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Accesso richiesto' });
};
exports.isAuthenticated = isAuthenticated;
