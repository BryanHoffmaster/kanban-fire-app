import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogConfig, MatDialogRef, MatDialogState, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ITask } from '../task/task';

@Component({
  selector: 'app-task-dialog',
  templateUrl: './task-dialog.component.html',
  styleUrls: ['./task-dialog.component.css']
})
export class TaskDialogComponent implements OnInit {
  private backupTask: Partial<ITask> = { ...this.data.task };

  /**
   * Returns the default config settings for this window, unless specifically passed
   * configs that should override the defaults. Note: `MatDialogConfig.data` is any information that will
   * be injected into the dialog instance.
   * @param overrideConfig Any window settings you want to apply to this window
   * @returns The dialog configuration settings for this component.
   */
  static windowArgs = (overrideConfig?: MatDialogConfig<any>): MatDialogConfig => {
    const config = new MatDialogConfig();

    // set default values
    const defaultConfig = new MatDialogConfig();
    defaultConfig.height = '270px';
    defaultConfig.width = '300px';

    // apply any passed in overrides if any
    for (const key in overrideConfig) {
      if (config.hasOwnProperty(key)) {
        config[key] = overrideConfig[key];
      }
    }

    return config;
  }


  // In the TaskDialogComponent we inject a reference to the dialog,
  // so we can close it, and we also inject the value of the provider
  // associated with the MAT_DIALOG_DATA token. This is the data object
  // that we passed to the open method in the AppComponent.
  constructor(
    public dialogRef: MatDialogRef<TaskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ITaskDialogData
  ) { }

  ngOnInit(): void {
  }
}

/**
 * What dialog information will be available to pass along from the new task dialog form.
 */
export interface ITaskDialogData {
  task: Partial<ITask>;
  enableDelete: boolean;
}

/** What information will be available from the dialog result. (on close event) */
export interface ITaskDialogResult {
  task: ITask;
  delete?: boolean;
  cancel?: boolean;
}
