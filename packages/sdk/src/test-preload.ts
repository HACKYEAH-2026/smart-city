import { afterAll } from "bun:test";
import { closeTestEngine } from "./testing";

afterAll(closeTestEngine);
