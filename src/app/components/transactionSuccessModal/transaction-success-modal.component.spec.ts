import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionSuccessModalComponent } from './transaction-success-modal.component';

describe('TransactionSuccessModalComponent', () => {
  let component: TransactionSuccessModalComponent;
  let fixture: ComponentFixture<TransactionSuccessModalComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TransactionSuccessModalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionSuccessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
