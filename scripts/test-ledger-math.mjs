import { centsOf, calculateLedgerBalance, summarizeLedger } from '../src/lib/ledgerMath.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const row=(id,type,amount,extra={})=>({id,entry_type:type,amount,...extra});

test('mixed credit and partial payments produce exact outstanding balance',()=>{
 const rows=[row('a','credit','100.10'),row('b','payment','25.05'),row('c','payment','10.05')];
 assert.equal(calculateLedgerBalance(rows),6500);
 assert.deepEqual(summarizeLedger(rows),{credit:10010,payment:3510,reversal:0,balance:6500});
});

test('decimal values are accumulated as integer cents without floating point drift',()=>{
 const rows=Array.from({length:100},(_,i)=>row(String(i),'credit','0.10'));
 assert.equal(calculateLedgerBalance(rows),1000);
 assert.equal(centsOf('12.34'),1234);
 assert.equal(centsOf(0.29),29);
 assert.equal(centsOf(1.15),115);
});

test('reversal cancels the original entry rather than being treated as a payment',()=>{
 const rows=[row('credit-1','credit','75.25'),row('pay-1','payment','10.25'),row('rev-1','reversal','75.25',{corrects_entry_id:'credit-1'})];
 assert.equal(calculateLedgerBalance(rows),-1025);
 assert.deepEqual(summarizeLedger(rows),{credit:7525,payment:1025,reversal:-7525,balance:-1025});
});

test('reversal without a matching original is rejected instead of silently corrupting balance',()=>{
 assert.throws(()=>calculateLedgerBalance([row('rev-1','reversal','20.00',{corrects_entry_id:'missing'})]),/मूल लेन-देन/);
});

test('unsupported transaction type and invalid decimal values are rejected',()=>{
 assert.throws(()=>centsOf('1.239'),/दो दशमलव/);
 assert.throws(()=>calculateLedgerBalance([row('x','refund','10.00')]),/लेन-देन प्रकार/);
});

test('duplicate reversal references are rejected to prevent double adjustment',()=>{
 const rows=[row('c1','credit','50.00'),row('r1','reversal','50.00',{corrects_entry_id:'c1'}),row('r2','reversal','50.00',{corrects_entry_id:'c1'})];
 assert.throws(()=>calculateLedgerBalance(rows),/एक ही लेन-देन/);
});
