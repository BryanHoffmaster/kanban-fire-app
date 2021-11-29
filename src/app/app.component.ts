import { CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, ViewChild } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TaskDialogComponent, ITaskDialogResult } from './task-dialog/task-dialog.component';
import { ITask } from './task/task';

 // TODO: Set up user accounts
// TODO: routes?
// TODO: Create a service to encapsulate the any transactional firestore logic behind this.
// TODO: How does this look on mobile?
// TODO: in the future, add labels that correspond to lanes, then make lanes filterable for users (use url routes/params to bookmark views)
// TODO: User Authentication : https://www.positronx.io/full-angular-7-firebase-authentication-system/ , create roles?
// TODO: checkout more on firestore collection auditTrail for collection value changes auditing.

export type Collections = keyof typeof Collections;
export const Collections = strEnum(['todo', 'done', 'inProgress' ]);

/** Utility function to create a K:V from a list of strings */
function strEnum<T extends string>(obj: Array<T>): {[K in T]: K} {
  return obj.reduce((res, key) => {
    res[key] = key;
    return res;
  }, Object.create(null));
}

const getObservable = (collection: AngularFirestoreCollection<ITask>, internalCollectionRef?: ITask[]) => {
  const subject = new BehaviorSubject<ITask[]>([]); // initialize with empty array
  collection.valueChanges({ idField: 'id' }).subscribe({
    next: (tasks: ITask[]) => {
      const orderedTasks = orderTasks(tasks)
      if (internalCollectionRef) internalCollectionRef = orderedTasks
      subject.next(orderedTasks)
    },
    // TODO:Is there an error that happens that you want to clear this subscription? throw?
    error: err => console.error(`ERROR: Collection value change error for : ${collection} `, err),
    complete: () => { if (!environment.production) console.debug('Collection') }
  });
  return subject;
};

const orderTasks = (items: ITask[]): ITask[] => items.sort((a, b) => a.order - b.order);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'kanban-fire-app';

  private _todo: ITask[] = [];
  private _inProgress: ITask[] = [];
  private _done: ITask[] = [];

  // TODO: Bring thise store references out to private variables/ or start a service

  todo = getObservable(this.store.collection('todo'), this._todo) as Observable<ITask[]>;
  inProgress = getObservable(this.store.collection('inProgress'), this._inProgress) as Observable<ITask[]>;
  done = getObservable(this.store.collection('done'), this._done) as Observable<ITask[]>;

  @ViewChild('todoList', { static: true }) todoList!: CdkDropList;
  @ViewChild('inProgressList', { static: true }) inProgressList!: CdkDropList;
  @ViewChild('doneList', { static: true }) doneList!: CdkDropList;

  constructor(private dialog: MatDialog, private store: AngularFirestore) { }

  editTask(list: Collections, task: ITask): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, TaskDialogComponent.windowArgs({
      data: {
        task,
        enableDelete: true
      }
    }));

    dialogRef.afterClosed().subscribe((result: ITaskDialogResult) => {
      if (!result || result.cancel) { return; } // do nothing.

      if (result.delete) {
        this.store.collection(list).doc(task.id).delete();
      } else {
        this.store.collection(list).doc(task.id).update(result.task);
      }
    });
  }

  drop(event: CdkDragDrop<ITask[] | null>): void {
    if (!event) return;

    // If an task was reordered in the same lane
    if (event.previousContainer.id === event.container.id) {
      const listObj = this[`${event.container.id}List`] as CdkDropList;

      // TODO: Just updating the collection does not update the list locally, why?
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);

      this.orderListTasks(Collections[event.container.id], listObj);

      // If the drop occurred in another lane
    } else if (event.previousContainer.id != event.container.id) {
      const item = event.previousContainer.data[event.previousIndex];

      this.store.firestore.runTransaction(() => {
        const promise = Promise.all([
          // these operations runs async, delete the item from the previous container, add it to the new one
          this.store.collection(event.previousContainer.id).doc(item.id).delete(),
          this.store.collection(event.container.id).add(item),
        ]);
        return promise;
      });

      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
  }

  // Adds a new task to the 'todo' lane.
  newTask(): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, TaskDialogComponent.windowArgs({
      data: {
        task: {},
      }
    }));

    dialogRef.afterClosed().subscribe((result: ITaskDialogResult) => {
      if (result?.task?.title) {
        result.task.order = 0; // new ones always at the top of the list
        // TODO: Right now the drgList has an order that is updated when a new item is given with an order zero
        // then it calls order tasks list based on that number back to the DB, which then makes another round trip.
        // Can I make this more efficient?
        this.store.collection('todo').add(result.task).then(() => {
          this.orderListTasks(Collections['todo'], this.todoList);
        });
      }
    });
  }

  // do this before adding the
  // TODO: refactor into transaction service API member/property.
  private orderListTasks(collection: Collections, dropList: CdkDropList): void {
    if (!(collection in Collections)) return;

    const items = dropList.data as ITask[];
    const promiseTasks = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      item.order = index;
      promiseTasks.push(this.store.collection(collection.toString()).doc(item.id).update(item));
    }

    this.store.firestore.runTransaction(() => {
      const promise = Promise.all(promiseTasks);
      return promise;
    });
  }
}
