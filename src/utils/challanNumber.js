// Generates sequential document numbers such as CH-202610-0001 (challans) and RC-202610-0001 (receipts).
const { supabase } = require('../config/supabase');

// Finds the highest existing number with this prefix and returns the next `count` numbers.
async function nextNumbers(table, column, prefix, count = 1) {
  const { data, error } = await supabase
    .from(table).select(column).like(column, `${prefix}%`)
    .order(column, { ascending: false }).limit(1);
  if (error) throw error;
  const last = data.length ? parseInt(data[0][column].slice(prefix.length), 10) : 0;
  return Array.from({ length: count }, (_, i) => prefix + String(last + i + 1).padStart(4, '0'));
}

// month is "YYYY-MM"
const nextChallanNumbers = (month, count = 1) =>
  nextNumbers('challans', 'challan_no', `CH-${month.replace('-', '')}-`, count);

const nextReceiptNumbers = (month, count = 1) =>
  nextNumbers('payments', 'receipt_no', `RC-${month.replace('-', '')}-`, count);

module.exports = { nextChallanNumbers, nextReceiptNumbers };
