import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import "rxjs/add/observable/concat";
import "rxjs/add/observable/empty";
import "rxjs/add/observable/merge";
import "rxjs/add/observable/of";
import "rxjs/add/operator/catch";
import "rxjs/add/operator/concat";
import "rxjs/add/operator/delay";
import "rxjs/add/operator/do";
import "rxjs/add/operator/first";
import "rxjs/add/operator/filter";
import "rxjs/add/operator/last";
import "rxjs/add/operator/map";
import "rxjs/add/operator/observeOn";
import "rxjs/add/operator/publishLast";
import "rxjs/add/operator/scan";
import "rxjs/add/operator/skip";
import "rxjs/add/operator/startWith";
import "rxjs/add/operator/subscribeOn";
import "rxjs/add/operator/switchMap";
import "rxjs/add/operator/takeLast";
import "rxjs/add/operator/takeUntil";
import "rxjs/add/operator/timeout";
import "rxjs/add/operator/toPromise";
import "requirejs";
import "object-assign";
const assign = require("object-assign");

export interface TodoItemModel {
    id: string;
    text: string;
    editingText: string;
    isDone: boolean;
    isEditing: boolean;
    update(text: string): void;
    markDone(): void;
    markUndone(): void;
    startEdition(): void;
    cancelEdition(): void;
    acceptEdition(): void;
}

export interface TodoListModel {
    items: TodoItemModel[];
    filteredItems: TodoItemModel[];
    filter: "all" | "done" | "notDone";
    text: string;
    isEditing: boolean;
    update(text: string): void;
    startEdition(): void;
    cancelEdition(): void;
    acceptEdition(): void;
    setFilter(filter: "all" | "done" | "notDone"): void;
}

export const defaultTodoItemModel =
    (id: string) => ({
        id,
        text: "",
        editingText: "",
        isDone: false,
        isEditing: false,
    });

export type TodoItemTextCommand = { type: "update", text: string }
export type TodoItemEmptyCommand = {
    type: "markDone" | "markUndone" | "startEdition" | "cancelEdition" | "acceptEdition";
}
export type TodoItemCommand = TodoItemTextCommand | TodoItemEmptyCommand;

export type TodoItemTextEvent = { type: "updated"; text: string; }
export type TodoItemIsDoneEvent = { type: "markedAsDone"; isDone: boolean; }
export type TodoItemEmptyEvent = {
    type: "editionStarted" | "editionCancelled" | "editionAccepted";
}
export type TodoItemEvent = TodoItemTextEvent | TodoItemIsDoneEvent | TodoItemEmptyEvent;

export class TodoItemStore {
    private static nextIdVal: number = 1;
    private static nextId = () => String(TodoItemStore.nextIdVal++).valueOf();

    public update: Observable<string>;
    public markDone: Observable<void>;
    public markUndone: Observable<void>;
    public startEdition: Observable<void>;
    public cancelEdition: Observable<void>;
    public acceptEdition: Observable<void>;

    public commands: Observable<TodoItemCommand>;
    public events: Observable<TodoItemEvent>;

    public states: Observable<TodoItemModel>;

    private updated: Observable<string>;
    private markedAsDone: Observable<boolean>;
    private editionStarted: Observable<void>;
    private editionCancelled: Observable<void>;
    private editionAccepted: Observable<void>;

    public constructor() {
        const update = new Subject<string>(); this.update = update;
        const markDone = new Subject<void>(); this.markDone = markDone;
        const markUndone = new Subject<void>(); this.markUndone = markUndone;
        const startEdition = new Subject<void>(); this.startEdition = startEdition;
        const cancelEdition = new Subject<void>(); this.cancelEdition = cancelEdition;
        const acceptEdition = new Subject<void>(); this.acceptEdition = acceptEdition;

        const defaultModelState = defaultTodoItemModel(TodoItemStore.nextId());

        const defaultState: TodoItemModel =
            assign(defaultModelState, {
                update: (text: string) => update.next(text),
                markDone: () => markDone.next(),
                markUndone: () => markUndone.next(),
                startEdition: () => startEdition.next(),
                cancelEdition: () => cancelEdition.next(),
                acceptEdition: () => acceptEdition.next(),
            });

        const events = Observable.merge(
            this.updated.map((text: string) => ({ type: "updated", text })),
            this.markedAsDone.map((isDone: boolean) => ({ type: "markedAsDone", isDone })),
        );

        const states = events
            .scan((model, action) => {
                switch (action.type) {
                    case "markedAsDone": return assign({}, model, { isDone: true });
                    default:
                        return model;
                }
            }, defaultState)
            .startWith(defaultState)
            .publishLast();
        states.connect();
    }
}


