import { CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, ViewChild } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/firestore';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Observable } from 'rxjs';
import { TaskDialogComponent, ITaskDialogResult } from './task-dialog/task-dialog.component';
import { ITask } from './task/task';

// TODO: Add ability to order the tasks, the "lanes" currently do not allow re-ordering
//      -- Requires that tasks track their order, and it reflects state from the DB
//      -- OnDrop needs to run updateItemOrder
// TODO: Set up user accounts
// TODO: routes?
// TODO: Create a service to encapsulate the any transactional firestore logic behind this.
// TODO: How does this look on mobile?
// TODO: in the future, add labels that correspond to lanes, then make lanes filterable for users (use url routes/params to bookmark views)

export type Collections = 'todo' | 'done' | 'inProgress';

const getObservable = (collection: AngularFirestoreCollection<ITask>) => {
  const subject = new BehaviorSubject<ITask[]>([]); // initialize with empty array
  collection.valueChanges({ idField: 'id' }).subscribe((tasks: ITask[]) => {
    subject.next(orderTasks(tasks));
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

  todo = getObservable(this.store.collection('todo')) as Observable<ITask[]>;
  inProgress = getObservable(this.store.collection('inProgress')) as Observable<ITask[]>;
  done = getObservable(this.store.collection('done')) as Observable<ITask[]>;

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
      if (result.cancel) { return; } // do nothing.

      if (result.delete) {
        this.store.collection(list).doc(task.id).delete();
      } else {
        this.store.collection(list).doc(task.id).update(result.task);
      }
    });
  }

  drop(event: CdkDragDrop<ITask[] | null>): void {
    if (event.previousContainer === event.container) {
      const reorderItem = event.container.data[event.currentIndex];
      reorderItem.order = event.currentIndex;

      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.store.collection(event.container.id).doc(reorderItem.id).update(reorderItem.order);
      return;
    }

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

  // Adds a new task to the 'todo' lane.
  newTask(): void {
    const dialogRef = this.dialog.open(TaskDialogComponent, TaskDialogComponent.windowArgs({
      data: {
        task: {},
      }
    }));

    dialogRef.afterClosed().subscribe((result: ITaskDialogResult) => {
      if (result.task.title) {
        result.task.order = 0; // new ones always at the top of the list
        // TODO: Right now the drgList has an order that is updated when a new item is given with an order zero
        // then it calls order tasks list based on that number back to the DB, which then makes another round trip.
        // Can I make this more efficient?
        this.store.collection('todo').add(result.task).then(() => {
          this.orderListTasks('todo', this.todoList);
        });
      }
    });
  }

  // do this before adding the
  // TODO: refactor into transaction service API member/property.
  private orderListTasks(collection: Collections, dropList: CdkDropList): void {
    const items = dropList.data as ITask[];
    const promiseTasks = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      item.order = index;
      promiseTasks.push(this.store.collection(collection).doc(item.id).update(item));
    }

    this.store.firestore.runTransaction(() => {
      const promise = Promise.all(promiseTasks);
      return promise;
    });
  }
}
