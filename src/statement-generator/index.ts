
import { aggregateClone, aggregateCreate, aggregateDrop, aggregateReplace } from "./aggregate";
import { functionClone } from "./function/clone";
import { functionCreate } from "./function/create";
import { functionDrop } from "./function/drop";
import { indexCreate, indexDrop } from "./index/index";
import { keyspaceAlter } from "./keyspace/alter";
import { keyspaceClone } from "./keyspace/clone";
import { keyspaceCreate } from "./keyspace/create";
import { keyspaceDrop } from "./keyspace/drop";
import { exportStructure } from "./keyspace/export";
import { materializedViewAlter, materializedViewClone, materializedViewCreate, materializedViewDrop } from "./materialized-view/index";
import { tableAlterAdd, tableAlterDrop, tableClone, tableCreate, tableDrop, tableTruncate } from "./table";
import { tableDelete } from "./table/delete";
import { tableInsert } from "./table/insert";
import { tableSelect, tableSelectAll } from "./table/select";
import { tableUpdate } from "./table/update";
import { typeAlter, typeClone, typeCreate, typeDrop } from "./type/index";

export class StatementGenerator {

    public tableSelectAll = tableSelectAll;
    public tableSelect = tableSelect;
    public tableClone = tableClone;
    public tableCreate = tableCreate;
    public tableDrop = tableDrop;
    public tableUpdate = tableUpdate;
    public tableInsert = tableInsert;
    public tableDelete = tableDelete;

    public tableTruncate = tableTruncate;
    public tableAlterAdd = tableAlterAdd;
    public tableAlterDrop = tableAlterDrop;

    public keyspaceDrop = keyspaceDrop;
    public keyspaceAlter = keyspaceAlter;
    public keyspaceClone = keyspaceClone;
    public keyspaceCreate = keyspaceCreate;

    public indexCreate = indexCreate;
    public indexDrop = indexDrop;

    public functionCreate = functionCreate;
    public functionClone = functionClone;
    public functionDrop = functionDrop;

    public typeCreate = typeCreate;
    public typeAlter = typeAlter;
    public typeClone = typeClone;
    public typeDrop = typeDrop;

    public aggregateCreate = aggregateCreate;
    public aggregateReplace = aggregateReplace;
    public aggregateClone = aggregateClone;
    public aggregateDrop = aggregateDrop;

    public materializedViewCreate = materializedViewCreate;
    public materializedViewAlter = materializedViewAlter;
    public materializedViewClone = materializedViewClone;
    public materializedViewDrop = materializedViewDrop;

    public exportStructure = exportStructure;

    constructor(private limit: number = 1000) {

    }

}
