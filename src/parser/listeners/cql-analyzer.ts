import { ParserRuleContext } from "antlr4ts";
import { ParseTree } from "antlr4ts/tree/ParseTree";
import {
    ColumnContext, CqlContext, ExpressionContext, KeyspaceContext, RootContext,
    StatementSeparatorContext, TableSpecContext, UseContext,
} from "../../antlr/CqlParser";
import { CqlParserListener } from "../../antlr/CqlParserListener";
import { CassandraClusterData } from "../../types";
import { CassandraKeyspace } from "../../types/index";
import {
    AnalysisKeyspaceReferences, AnalysisKeyspaceReferenceType, AnalyzedStatement, AnalyzedStatementRange,
    AnalyzedStatementRules,
    AnalyzedStatementToken, CqlAnalysis, CqlAnalysisError, CqlStatementColumn,
    CqlStatementExpression, CqlStatementType,
} from "../../types/parser";

const KEYSPACE_RULE = "keyspace";
const TABLE_RULE = "table";
const STATEMENT_ROOT_RULE = "cql";

export class CqlAnalyzerListener implements CqlParserListener {
    private statementCurrent: number = -1;
    private result: CqlAnalysis = {
        cluserName: null,
        statements: [],
        statementRanges: [],
        references: {},
        alterData: false,
        alterStructure: false,
        selectData: false,
    };

    private rulePrevious: string;
    private keyspaceAmbiental: string;
    private separators: number[] = [];

    constructor(
        private ruleNames: string[],
        private cql: string,
        private structure: CassandraClusterData,
        private keyspaceInitial: string,
    ) {

        this.keyspaceAmbiental = this.keyspaceInitial;
        this.result.cluserName = structure.name;

    }
    public getResult() {
        return this.result;
    }
    exitRoot = (ctx: RootContext) => {

        const modData = this.result.statements.filter((i) =>
            i.type === "update" ||
            i.type === "insert" ||
            i.type === "delete" ||
            i.type === "truncate");

        const modStruct = this.result.statements.filter((i) =>
            i.type === "alterKeyspace" ||
            i.type === "alterMaterializedView" ||
            i.type === "alterRole" ||
            i.type === "alterTable" ||
            i.type === "alterUser" ||
            i.type === "alterType" ||
            i.type === "createAggregate" ||
            i.type === "createFunction" ||
            i.type === "createIndex" ||
            i.type === "createKeyspace" ||
            i.type === "createMaterializedView" ||
            i.type === "createRole" ||
            i.type === "createTable" ||
            i.type === "createTrigger" ||
            i.type === "createType" ||
            i.type === "createUser" ||
            i.type === "dropAggregate" ||
            i.type === "dropFunction" ||
            i.type === "dropIndex" ||
            i.type === "dropKeyspace" ||
            i.type === "dropMaterializedView" ||
            i.type === "dropRole" ||
            i.type === "dropTable" ||
            i.type === "dropTrigger" ||
            i.type === "dropType" ||
            i.type === "dropUser" ||
            i.type === "grant",
        );

        const selectData = this.result.statements.filter((i) => i.type === "select");

        this.result.alterData = modData.length > 0 ? true : false;
        this.result.alterStructure = modStruct.length > 0 ? true : false;
        this.result.selectData = selectData.length > 0 ? true : false;

        // collect statements
        this.result.statements.forEach((s, i) => {
            this.result.statements[i].text = this.cql.substring(s.charStart, s.charStop + 1);
        });

        if ((this.result.alterData || this.result.alterStructure) && this.result.selectData) {
            this.result.error = CqlAnalysisError.SELECT_AND_ALTER;
        }
        if (selectData.length > 1) {
            this.result.error = CqlAnalysisError.MULTIPLE_SELECT;
        }

        /* remove
        this.result.statements.forEach((s, i) => {
            if (s.keyspace && s.table) {
                const ksi = this.structure.keyspaces.findIndex((k) => k.name === s.keyspace);
                if (ksi > -1) {
                    const ks = this.structure.keyspaces[ksi];
                    this.result.statements[i].keyspaceData = ks;
                    const tbi = ks.tables.findIndex((t) => t.name === s.table);
                    if (tbi > -1) {
                        this.result.statements[i].tableData = ks.tables[tbi];
                    }
                }
            }
        });
        */

        // if (this.result.statementRanges.length < this.result.statements.length && this.result.statementRanges.length > 0) {
        if (this.separators && this.separators[this.separators.length - 1] < this.cql.length) {
            // add last range
            const sp = this.cql.length;
            this.addStatementRange(sp);

            // const last = this.result.statementRanges[this.result.statementRanges.length - 1];
            // const item: AnalyzedStatementRange = {
            //     start: last.stop + 2, // to skip last semicolon
            //     stop: this.cql.length,
            //     text: this.cql.substring(last.stop + 2, this.cql.length),
            // };
            // this.result.statementRanges.push(item);
        }

        if (this.result.statements.length === 1 && this.result.statementRanges.length === 0) {
            // add ALL as range
            const item: AnalyzedStatementRange = {
                start: 0, // to skip last semicolon
                stop: this.cql.length,
                text: this.cql,
            };
            this.result.statementRanges.push(item);
        }

    }
    enterEveryRule = (ctx: ParserRuleContext): void => {
        const rule: string = this.ruleNames[ctx.ruleIndex];

        if (this.rulePrevious === STATEMENT_ROOT_RULE) {
            this.collectType(ctx);
        }

        // ----
        this.rulePrevious = rule;
    }
    enterCql = (ctx: ParserRuleContext): void => {
        this.statementCurrent += 1;
        this.result.statements[this.statementCurrent] = {
            type: null,
            columns: [],
            expressions: [],
            rules: {},
        };

    }
    exitCql = (ctx: CqlContext) => {
        const k = this.getResultValue("keyspace");
        if (k == null) {
            this.setCurrentStatementValue("keyspace", this.keyspaceAmbiental);
        }
        this.setCurrentStatementValue("charStart", ctx.start.startIndex);
        this.setCurrentStatementValue("charStop", ctx.stop.stopIndex);

        // check column types! After cql keyspace + table needed
        this.columnsRecognize(this.statementCurrent);
    }
    exitStatementSeparator = (ctx: StatementSeparatorContext) => {
        const pos = ctx.start.startIndex;
        this.addStatementRange(pos);
    }
    exitExpression = (ctx: ExpressionContext): void => {
        const expression: CqlStatementExpression = {
            //     kind: null,
            //     kindIndex: -1,
            //     kindCount: -1,
            //     type: null,
            text: ctx.text,
            charStart: ctx.start.startIndex,
            charStop: ctx.stop.stopIndex,
        };

        this.result.statements[this.statementCurrent].expressions.push(expression);
    }
    exitColumn = (ctx: ColumnContext): void => {
        const column: CqlStatementColumn = {
            kind: null,
            kindIndex: -1,
            kindCount: -1,
            type: null,
            text: ctx.text,
            charStart: ctx.start.startIndex,
            charStop: ctx.stop.stopIndex,
        };

        this.result.statements[this.statementCurrent].columns.push(column);
    }
    exitUse = (ctx: UseContext): void => {
        if (ctx.children.length < 2) {
            return;
        }

        const k = ctx.getChild(1) as KeyspaceContext;
        const rule = this.ruleNames[k.ruleIndex];

        if (rule === KEYSPACE_RULE) {
            this.keyspaceAmbiental = k.text;
        }

    }
    exitTableSpec = (ctx: TableSpecContext) => {
        const ksc = ctx.children.find((c: ParserRuleContext) => this.ruleNames[c.ruleIndex] === KEYSPACE_RULE) as ParserRuleContext;
        const tbc = ctx.children.find((c: ParserRuleContext) => this.ruleNames[c.ruleIndex] === TABLE_RULE) as ParserRuleContext;

        const keyspaceName = !ksc ? this.keyspaceAmbiental : ksc.text;
        let ksd: CassandraKeyspace = null;
        try {

            if (keyspaceName) {
                ksd = this.structure.keyspaces.find((k) => k.name === keyspaceName);
            }

            if (ksc) {
                const kt = this.contextToToken(ksc);
                this.pushRuleValue("tableSpec", "keyspaceToken", kt);
                this.setCurrentStatementValue("keyspace", keyspaceName);

            } else {
                this.pushRuleValue("tableSpec", "keyspaceAmbiental", this.keyspaceAmbiental);
            }

            if (tbc) {
                const tt = this.contextToToken(tbc);
                const tbd = ksd ? ksd.tables.find((t) => t.name === tt.text) : null;
                this.pushRuleValue("tableSpec", "tableToken", tt);
                this.setCurrentStatementValue("table", tbc.text);

                if (tbd) {
                    this.pushReference(keyspaceName, "tables", tt.text, tbd);
                }

            }
        } catch (e) {
            console.log(e);
        }

    }

    // ------------------------------------------------------------------------------------
    private collectType(ctx: ParserRuleContext): void {
        const rule: string = this.ruleNames[ctx.ruleIndex];
        let type: CqlStatementType = null;

        switch (rule) {
            case "alterKeyspace":
                type = rule as CqlStatementType;
                break;
            case "alterMaterializedView":
                type = rule as CqlStatementType;
                break;
            case "alterRole":
                type = rule as CqlStatementType;
                break;
            case "alterTable":
                type = rule as CqlStatementType;
                break;
            case "alterType":
                type = rule as CqlStatementType;
                break;
            case "alterUser":
                type = rule as CqlStatementType;
                break;
            case "applyBatch":
                type = rule as CqlStatementType;
                break;
            case "createAggregate":
                type = rule as CqlStatementType;
                break;
            case "createFunction":
                type = rule as CqlStatementType;
                break;
            case "createIndex":
                type = rule as CqlStatementType;
                break;
            case "createKeyspace":
                type = rule as CqlStatementType;
                break;
            case "createMaterializedView":
                type = rule as CqlStatementType;
                break;
            case "createRole":
                type = rule as CqlStatementType;
                break;
            case "createTable":
                type = rule as CqlStatementType;
                break;
            case "createTrigger":
                type = rule as CqlStatementType;
                break;
            case "createType":
                type = rule as CqlStatementType;
                break;
            case "createUser":
                type = rule as CqlStatementType;
                break;
            case "delete":
                type = rule as CqlStatementType;
                break;
            case "dropAggregate":
                type = rule as CqlStatementType;
                break;
            case "dropFunction":
                type = rule as CqlStatementType;
                break;
            case "dropIndex":
                type = rule as CqlStatementType;
                break;
            case "dropKeyspace":
                type = rule as CqlStatementType;
                break;
            case "dropMaterializedView":
                type = rule as CqlStatementType;
                break;
            case "dropRole":
                type = rule as CqlStatementType;
                break;
            case "dropTable":
                type = rule as CqlStatementType;
                break;
            case "dropTrigger":
                type = rule as CqlStatementType;
                break;
            case "dropType":
                type = rule as CqlStatementType;
                break;
            case "dropUser":
                type = rule as CqlStatementType;
                break;
            case "grant":
                type = rule as CqlStatementType;
                break;
            case "insert":
                type = rule as CqlStatementType;
                break;
            case "listPermissions":
                type = rule as CqlStatementType;
                break;
            case "listRoles":
                type = rule as CqlStatementType;
                break;
            case "revoke":
                type = rule as CqlStatementType;
                break;
            case "select":
                type = rule as CqlStatementType;
                break;
            case "truncate":
                type = rule as CqlStatementType;
                break;
            case "update":
                type = rule as CqlStatementType;
                break;
            case "use":
                type = rule as CqlStatementType;
                break;

            default:
                type = "empty";
                break;
        }

        this.setCurrentStatementValue("type", type);

    }
    private setCurrentStatementValue<K extends keyof AnalyzedStatement>(k: K, v: AnalyzedStatement[K]) {
        this.result.statements[this.statementCurrent][k] = v;
    }
    private getResultValue<K extends keyof AnalyzedStatement>(k: K): AnalyzedStatement[K] {
        return this.result.statements[this.statementCurrent][k];
    }
    private columnsRecognize(currentStatementIndex: number) {
        const s = this.result.statements[currentStatementIndex];
        const k = s.keyspace;
        const t = s.table;
        if (!k || !t) {
            return;
        }
        const ksi = this.structure.keyspaces.findIndex((i) => i.name === k);

        if (ksi < 0) {
            return;
        }

        const ksd = this.structure.keyspaces[ksi];
        const tbi = ksd.tables.findIndex((i) => i.name === t);

        if (tbi < 0) {
            return;
        }
        const tbd = ksd.tables[tbi];

        const columns = s.columns.map((i) => {

            const tc = tbd.columns.find((z) => z.name === i.text);
            if (!tc) {
                i.kind = "not_found";
                return i;
            }
            i.kind = tc.kind;
            i.type = tc.type;
            i.kindIndex = tc.position;
            i.kindCount = tbd.columns.filter((c) => c.kind === tc.kind).length;
            i.clustering_order = tc.clustering_order;
            return i;
        });

        s.columns = columns;

    }
    private addStatementRange(endPosition: number) {
        const lastIndex = this.separators.length - 1;
        const lastPos = lastIndex >= 0 ? this.separators[lastIndex] + 2 : 0;
        const body = this.cql.substring(lastPos, endPosition);

        const item: AnalyzedStatementRange = {
            start: lastPos,
            stop: endPosition,
            text: body,
        };

        this.result.statementRanges.push(item);
        this.separators.push(endPosition);
    }
    private contextToToken(ctx: ParserRuleContext | ParseTree): AnalyzedStatementToken {
        const inCtx = ctx as ParserRuleContext;
        const out: AnalyzedStatementToken = {
            charStart: inCtx.start.startIndex,
            charStop: inCtx.stop.stopIndex,
            text: inCtx.text,
        };
        return out;
    }
    private pushRuleValue<R extends keyof AnalyzedStatementRules, V extends keyof AnalyzedStatementRules[R]>(
        rule: R, prop: V, value: AnalyzedStatementRules[R][V]) {

        const s = this.result.statements[this.statementCurrent];
        if (s.rules[rule] == null) {
            s.rules[rule] = {};
        }

        s.rules[rule][prop] = value;

    }
    private pushReference<R extends keyof AnalysisKeyspaceReferences>(
        keyspace: string, set: R, name: string, value: AnalysisKeyspaceReferenceType[R]) {

        const r = this.result.references;
        if (!r[keyspace]) {
            r[keyspace] = {};
        }
        if (!r[keyspace][set]) {
            r[keyspace][set] = {};
        }
        r[keyspace][set][name] = value;
    }
}
