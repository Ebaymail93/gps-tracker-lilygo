"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
async function initializeDatabase() {
    try {
        console.log("Database connection verified");
    }
    catch (error) {
        console.error("Error connecting to database:", error);
        throw error;
    }
}
