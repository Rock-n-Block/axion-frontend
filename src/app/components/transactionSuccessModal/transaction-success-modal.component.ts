import { Component, Inject } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";

@Component({
  selector: "app-transaction-success-modal",
  templateUrl: "./transaction-success-modal.component.html",
})
export class TransactionSuccessModalComponent {
  public ethLink: string;
  constructor(
    public dialogRef: MatDialogRef<TransactionSuccessModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.ethLink = `https://rinkeby.etherscan.io/tx/${data}`;
  }
  public closeModal() {
    this.dialogRef.close();
  }
}
