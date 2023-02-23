function outer() {
  let count = 0;

  function inner() {
    count++;
    console.log(count);
  }

  return inner;
}

console.log(outer()());

// closure(); // logs 1
// closure(); // logs 2
// closure(); // logs 3
