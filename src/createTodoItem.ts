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

export interface TodoItemState {
  id: string;
  text: string;
  editingText: string;
  isDone: boolean;
  isEditing: boolean;
  updateEditingText(text: string): void;
  markDone(): void;
  markUndone(): void;
  startEdition(): void;
  cancelEdition(): void;
  acceptEdition(): void;
}

export interface EditionStarted { kind: "edition-started"; }
export interface EditionCancelled { kind: "edition-cancelled"; }
export interface EditionAccepted { kind: "edition-accepted"; }
export interface EditingTextUpdated { kind: "editing-text-updated"; text: string; }
export interface MarkedAsDone { kind: "marked-as-done"; }
export interface MarkedAsUndone { kind: "marked-as-undone"; }
export type TodoItemEvent =
  EditionStarted | EditionCancelled | EditionAccepted |
  EditingTextUpdated | MarkedAsDone | MarkedAsUndone;

export const createTodoItem = (id: string, initText?: string) => {

  // COMMANDS

  const commandSubjects = {
    startEdition$: new Subject<void>(),
    cancelEdition$: new Subject<void>(),
    acceptEdition$: new Subject<void>(),
    updateEditingText$: new Subject<string>(),
    markDone$: new Subject<void>(),
    markUndone$: new Subject<void>(),
  };

  const commands = {
    startEdition$: commandSubjects.startEdition$ as Observable<void>,
    cancelEdition$: commandSubjects.cancelEdition$ as Observable<void>,
    acceptEdition$: commandSubjects.acceptEdition$ as Observable<void>,
    updateEditingText$: commandSubjects.updateEditingText$ as Observable<string>,
    markDone$: commandSubjects.markDone$ as Observable<void>,
    markUndone$: commandSubjects.markUndone$ as Observable<void>,

    startEdition: () => commandSubjects.startEdition$.next(),
    cancelEdition: () => commandSubjects.cancelEdition$.next(),
    acceptEdition: () => commandSubjects.acceptEdition$.next(),
    updateEditingText: (text: string) => commandSubjects.updateEditingText$.next(text),
    markDone: () => commandSubjects.markDone$.next(),
    markUndone: () => commandSubjects.markUndone$.next(),
  };

  // EVENTS

  const eventSubjects = {
    editionStarted$: new Subject<void>(),
    editionCancelled$: new Subject<void>(),
    editionAccepted$: new Subject<void>(),
    editingTextUpdated$: new Subject<string>(),
    markedAsDone$: new Subject<void>(),
    markedAsUndone$: new Subject<void>(),
  };

  const events = {
    event$: Observable.merge<TodoItemEvent>(
      eventSubjects.editionStarted$.map(() => ({ kind: "edition-started" })),
      eventSubjects.editionCancelled$.map(() => ({ kind: "edition-cancelled" })),
      eventSubjects.editionAccepted$.map(() => ({ kind: "edition-accepted" })),
      eventSubjects.editingTextUpdated$.map((text: string) => ({ kind: "editing-text-updated", text })),
      eventSubjects.markedAsDone$.map(() => ({ kind: "marked-as-done" })),
      eventSubjects.markedAsUndone$.map(() => ({ kind: "marked-as-undone" })),
    ),

    editionStarted$: eventSubjects.editionStarted$ as Observable<void>,
    editionCancelled$: eventSubjects.editionCancelled$ as Observable<void>,
    editionAccepted$: eventSubjects.editionAccepted$ as Observable<void>,
    editingTextUpdated$: eventSubjects.editingTextUpdated$ as Observable<string>,
    markedAsDone$: eventSubjects.markedAsDone$ as Observable<void>,
    markedAsUndone$: eventSubjects.markedAsUndone$ as Observable<void>,

    editionStarted: () => eventSubjects.editionStarted$.next(),
    editionCancelled: () => eventSubjects.editionCancelled$.next(),
    editionAccepted: () => eventSubjects.editionAccepted$.next(),
    editingTextUpdated: (text: string) => eventSubjects.editingTextUpdated$.next(text),
    markedAsDone: () => eventSubjects.markedAsDone$.next(),
    markedAsUndone: () => eventSubjects.markedAsUndone$.next(),
  };

  // INITIAL STATE

  const init: TodoItemState = {
    id,
    text: initText || "",
    editingText: "",
    isDone: false,
    isEditing: false,
    updateEditingText: commands.updateEditingText,
    markDone: commands.markDone,
    markUndone: commands.markUndone,
    startEdition: commands.startEdition,
    cancelEdition: commands.cancelEdition,
    acceptEdition: commands.acceptEdition,
  };

  // REDUCE

  const reduce = (state: TodoItemState, event: TodoItemEvent): TodoItemState => {
    switch (event.kind) {
      case "edition-started":
        return assign({}, state, { editingText: state.text, isEditing: true });

      case "edition-cancelled":
        return assign({}, state, { editingText: "", isEditing: false });

      case "edition-accepted":
        return assign({}, state, { text: state.editingText, editingText: "", isEditing: false });

      case "editing-text-updated":
        return assign({}, state, { editingText: event.text });

      case "marked-as-done":
        return assign({}, state, { isDone: true });

      case "marked-as-undone":
        return assign({}, state, { isDone: false });

      default:
        return state;
    }
  };

  // STATES

  const state$ = events.event$.scan(reduce, init).startWith(init).publishLast();

  // UPDATES

  const update$ = state$.withLatestFrom(events.event$, (state, event) => ({ state, event }));

  // EFFECTS

  // When UpdateEditingText is requested and the TodoItem isEditing then emit EditingTextUpdated
  commands
    .updateEditingText$
    .withLatestFrom(state$, (text, state) => ({ text, canContinue: state.isEditing }))
    .filter(e => e.canContinue)
    .map(e => e.text)
    .subscribe(events.editingTextUpdated);

  // When StartEdition is requested and the TodoItem is not editing and it's not done then emit EditionStarted
  commands
    .startEdition$
    .withLatestFrom(state$, (x, state) => !state.isEditing && !state.isDone)
    .filter(e => e)
    .subscribe(events.editionStarted);

  // When CancelEdition is requested and the TodoItem is editing then emit EditionCancelled
  commands
    .cancelEdition$
    .withLatestFrom(state$, (x, state) => state.isEditing)
    .filter(e => e)
    .subscribe(events.editionCancelled);

  // When AcceptEdition is requested and the TodoItem is editing then emit EditionAccepted
  commands
    .acceptEdition$
    .withLatestFrom(state$, (x, state) => state.isEditing)
    .filter(e => e)
    .subscribe(events.editionAccepted);

  // When MarkDone is requested and the TodoItem is not done then emit Marked As Done, cancel any edition in progress
  commands
    .markDone$
    .withLatestFrom(state$, (x, state) => !state.isDone)
    .filter(e => e)
    .subscribe(() => {
      events.editionCancelled();
      events.markedAsDone();
    });

  // When MarkUndone is requested and the TodoItem is done then emit Marked As Undone, cancel any edition in progress
  commands
    .markUndone$
    .withLatestFrom(state$, (x, state) => state.isDone)
    .filter(e => e)
    .subscribe(() => {
      events.editionCancelled();
      events.markedAsUndone();
    });

  // MANAGEMENT

  const start = () => state$.connect();

  return {
    commands,
    events,
    state$: state$ as Observable<TodoItemState>,
    update$,
    start,
  };
};
