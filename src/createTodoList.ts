import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import "rxjs/add/observable/concat";
import "rxjs/add/observable/empty";
import "rxjs/add/observable/merge";
import "rxjs/add/observable/of";
import "rxjs/add/operator/catch";
import "rxjs/add/operator/combineLatest";
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
import "rxjs/add/operator/withLatestFrom";
import "requirejs";
import "object-assign";
const assign = require("object-assign");

import { createTodoItem, TodoItemState } from "./createTodoItem";

export type TodoListFilter = "all" | "done" | "notDone";

export interface TodoListState {
  items: TodoItemState[];
  filteredItems: TodoItemState[];
  filter: TodoListFilter;
  createItem(text: string): void;
  setFilter(filter: TodoListFilter): void;
}

export interface FilterSet { kind: "filter-set"; filter: TodoListFilter; }
export interface ItemsChanged { kind: "items-changed"; items: TodoItemState[]; }
export interface FilteredItemsChanged { kind: "filtered-items-changed"; filteredItems: TodoItemState[]; }
export type TodoListEvent = FilterSet | ItemsChanged | FilteredItemsChanged;

export const createTodoList = () => {

  // COMMANDS

  const commandSubjects = {
    createItem$: new Subject<string>(),
    setFilter$: new Subject<TodoListFilter>(),
  };

  const commands = {
    createItem$: commandSubjects.createItem$ as Observable<string>,
    setFilter$: commandSubjects.setFilter$ as Observable<TodoListFilter>,

    createItem: (text: string) => commandSubjects.createItem$.next(text),
    setFilter: (filter: TodoListFilter) => commandSubjects.setFilter$.next(filter),
  };

  // EVENTS

  const eventSubjects = {
    filterSet$: new Subject<TodoListFilter>(),
    itemsChanged$: new Subject<TodoItemState[]>(),
    filteredItemsChanged$: new Subject<TodoItemState[]>(),
  };

  const events = {
    event$: Observable.merge<TodoListEvent>(
      eventSubjects.filterSet$.map((filter: TodoListFilter) => ({ kind: "filter-set", filter })),
      eventSubjects.itemsChanged$.map((items: TodoItemState[]) => ({ kind: "items-changed", items })),
      eventSubjects.filteredItemsChanged$.map((filteredItems: TodoItemState[]) =>
        ({ kind: "filtered-items-changed", filteredItems })),
    ),

    filterSet$: eventSubjects.filterSet$ as Observable<TodoListFilter>,
    itemsChanged$: eventSubjects.itemsChanged$ as Observable<TodoItemState[]>,
    filteredItemsChanged$: eventSubjects.filteredItemsChanged$ as Observable<TodoItemState[]>,

    filterSet: (filter: TodoListFilter) => eventSubjects.filterSet$.next(filter),
    itemsChanged: (items: TodoItemState[]) => eventSubjects.itemsChanged$.next(items),
    filteredItemsChanged: (filteredItems: TodoItemState[]) => eventSubjects.filteredItemsChanged$.next(filteredItems),
  };

  // INTERNALS

  let nextId = 1;

  const computeFilteredItems = (filter: TodoListFilter, items: TodoItemState[]): TodoItemState[] => {
    switch (filter) {
      case "all": return items;

      case "done": return items.filter(e => e.isDone);

      case "notDone": return items.filter(e => !e.isDone);

      default: return [];
    }
  };

  // INITIAL STATE

  const init: TodoListState = {
    items: [],
    filter: "all",
    filteredItems: computeFilteredItems("all", []),
    setFilter: commands.setFilter,
    createItem: commands.createItem,
  };

  // REDUCE

  const reduce = (state: TodoListState, event: TodoListEvent): TodoListState => {
    switch (event.kind) {
      case "filter-set":
        return assign({}, state, { filter: event.filter });

      case "items-changed":
        return assign({}, state, { items: event.items });

      case "filtered-items-changed":
        return assign({}, state, { filteredItems: event.filteredItems });

      default:
        return state;
    }
  };

  // STATES

  const state$ = events.event$.scan(reduce, init).startWith(init).publishLast();

  // UPDATES

  const update$ = state$.withLatestFrom(events.event$, (state, event) => ({ state, event }));

  // EFFECTS

  // When FilterSet or ItemsChanged events are emited, the filtered items needs to be recomputed
  events.filterSet$.combineLatest(events.itemsChanged$, computeFilteredItems)
    .subscribe(events.filteredItemsChanged);

  // When setFilter is requested and filter differs from the current one, a FilterSet is emited
  commands.setFilter$
    .withLatestFrom(state$, (filter, state) => ({ filter, canContinue: state.filter !== filter}))
    .filter(({canContinue}) => canContinue)
    .map(({filter}) => filter)
    .subscribe(events.filterSet);

  // When createItem is requested, then a new item is created
  commands.createItem$
    .filter(text => !!text)
    .subscribe(text => {
      const id = String(nextId++).valueOf();
      const itemStore = createTodoItem(id, text);
      itemStore.state$
        .withLatestFrom(state$, (item, state) => ({ item, state }))
        
    });

  const start = () => state$.connect();

  return {
    commands,
    events,
    state$: state$ as Observable<TodoListState>,
    update$,
    start,
  };
};
