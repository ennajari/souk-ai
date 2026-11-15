/** GS1 check digit for EAN-8, UPC-A (12) and EAN-13: rejects misread barcodes before they reach the cart. */
export function validGtin(code) {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()
  // weights 3,1,3,… starting from the digit next to the check digit
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}
