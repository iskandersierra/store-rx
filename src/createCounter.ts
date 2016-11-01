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
import "rxjs/add/operator/withLatestFrom";
import "requirejs";
import "object-assign";
const assign = require("object-assign");

export interface CounterState {
  count: number;
  increment(): void;
  decrement(): void;
  reset(): void;
}

export interface Increment { kind: "increment"; }
export interface Decrement { kind: "decrement"; }
export interface Reset { kind: "reset"; }
export type CounterCommand = Increment | Decrement | Reset;

export interface Incremented { kind: "incremented"; }
export interface Decremented { kind: "decremented"; }
export interface WasReset { kind: "was-reset"; }
export type CounterEvent = Incremented | Decremented | WasReset;

export const createCounter = (start: number = 0) => {
  // Commands
  const commandSubjects = {
    increment$: new Subject<void>(),
    decrement$: new Subject<void>(),
    reset$: new Subject<void>(),
  };
  const command$ = Observable.merge<CounterCommand>(
    commandSubjects.increment$.map<void, Increment>(() => ({ kind: "increment" })),
    commandSubjects.decrement$.map<void, Decrement>(() => ({ kind: "decrement" })),
    commandSubjects.reset$.map<void, Reset>(() => ({ kind: "reset" })),
  );
  const increment = () => commandSubjects.increment$.next();
  const decrement = () => commandSubjects.decrement$.next();
  const reset = () => commandSubjects.decrement$.next();

  const commands = {
    command$,
    increment,
    decrement,
    reset,
    increment$: commandSubjects.increment$ as Observable<void>,
    decrement$: commandSubjects.decrement$ as Observable<void>,
    reset$: commandSubjects.reset$ as Observable<void>,
  };

  // Events
  const eventSubjects = {
    incremented$: new Subject<void>(),
    decremented$: new Subject<void>(),
    wasReset$: new Subject<void>(),
  };
  const event$ = Observable.merge<CounterEvent>(
    eventSubjects.incremented$.map<void, Incremented>(() => ({ kind: "incremented" })),
    eventSubjects.decremented$.map<void, Decremented>(() => ({ kind: "decremented" })),
    eventSubjects.wasReset$.map<void, WasReset>(() => ({ kind: "was-reset" })),
  );
  const incremented = () => eventSubjects.incremented$.next();
  const decremented = () => eventSubjects.decremented$.next();
  const wasReset = () => eventSubjects.wasReset$.next();
  const events = {
    event$,
    incremented,
    decremented,
    wasReset,
    incremented$: eventSubjects.incremented$ as Observable<void>,
    decremented$: eventSubjects.decremented$ as Observable<void>,
    wasReset$: eventSubjects.wasReset$ as Observable<void>,
  };

  // State
  const init: CounterState = {
    count: start,
    increment, decrement, reset,
  };

  const reduce = (state: CounterState, event: CounterEvent) => {
    switch (event.kind) {
      case "incremented":
        return assign({}, state, { count: state.count + 1 });

      case "decremented":
        return assign({}, state, { count: state.count - 1 });

      case "was-reset":
        return assign({}, state, { count: 0 });

      default:
        return state;
    }
  };

  const connectableState$ = event$
    .scan(reduce, init)
    .startWith(init)
    .publishLast();

  const state$ = connectableState$ as Observable<CounterState>; // toObservable ???

  const update$ = state$.withLatestFrom(event$, (state, event) => ({ state, event }));

  // Effects

  commands
    .increment$
    .subscribe(events.incremented);

  commands
    .reset$
    .withLatestFrom(state$, (c, s) => s.count !== 0)
    .filter(v => v)
    .subscribe(() => events.wasReset());

  commands
    .decrement$
    .withLatestFrom(state$, (e, s) => s.count > 0)
    .filter(v => v)
    .subscribe(() => events.decremented());

  connectableState$.connect();

  return {
    commands,
    events,
    state$,
    update$,
  };
};
