import Dexie,{type Table} from 'dexie';
import {emptyWorkspace,workspaceSchema,type Workspace} from './domain';
export interface Repository {load():Promise<Workspace>;save(value:Workspace):Promise<void>;label:string}
class BrowserDB extends Dexie{records!:Table<{id:string;data:Workspace},string>;constructor(){super('contextos-v1');this.version(1).stores({records:'id'})}}
export async function createRepository():Promise<Repository>{
 if('__TAURI_INTERNALS__' in window){const {default:Database}=await import('@tauri-apps/plugin-sql');const db=await Database.load('sqlite:contextos.db');await db.execute('CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, version INTEGER NOT NULL)');return {label:'Desktop SQLite · local app data',async load(){const rows=await db.select<{data:string}[]>('SELECT data FROM workspace WHERE id = $1',[1]);return rows.length?workspaceSchema.parse(JSON.parse(rows[0].data)):emptyWorkspace()},async save(value){const data=workspaceSchema.parse(value);await db.execute('INSERT INTO workspace (id,data,version) VALUES ($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=excluded.data, version=excluded.version',[1,JSON.stringify(data),1])}}}
 const db=new BrowserDB();return {label:'Browser IndexedDB · local to this browser',async load(){const row=await db.records.get('workspace');return row?workspaceSchema.parse(row.data):emptyWorkspace()},async save(value){await db.records.put({id:'workspace',data:workspaceSchema.parse(value)})}};
}
