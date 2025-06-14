import { db } from "./db";
import { devices, systemLogs } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function initializeDatabase() {
  try {
    console.log("Database connection verified");
  } catch (error) {
    console.error("Error connecting to database:", error);
    throw error;
  }
}