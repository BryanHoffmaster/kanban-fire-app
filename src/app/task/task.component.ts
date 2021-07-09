import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ITask } from './task';

@Component({
  selector: 'app-task',
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.css']
})
export class TaskComponent implements OnInit {

  @Input() task: ITask | null = null;
  @Output() edit = new EventEmitter<ITask>();

  constructor() { }

  ngOnInit(): void {
  }

}
