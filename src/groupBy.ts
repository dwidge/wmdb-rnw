// Type definition for Object.groupBy if it doesn't exist
// declare global {
//   interface ObjectConstructor {
//     groupBy<T, K extends PropertyKey>(
//       items: Iterable<T>,
//       callback: (item: T, index: number) => K,
//     ): Record<K, T[]>;
//   }
// }

if (!Object.groupBy) {
  Object.defineProperty(Object, "groupBy", {
    value: <T, K extends PropertyKey>(
      items: Iterable<T>,
      callback: (item: T, index: number) => K,
    ): Record<K, T[]> => {
      const result: Record<K, T[]> = {} as Record<K, T[]>;
      let index = 0;
      for (const item of items) {
        const key = callback(item, index);
        if (Object.prototype.hasOwnProperty.call(result, key)) {
          result[key].push(item);
        } else {
          result[key] = [item];
        }
        index++;
      }
      return result;
    },
    writable: true,
    configurable: true,
  });
}

const example = () => {
  const people = [
    { name: "Alice", age: 25 },
    { name: "Bob", age: 30 },
    { name: "Charlie", age: 25 },
  ];

  // Now you can use Object.groupBy
  const groupedByAge = Object.groupBy(people, (person) => person.age);
  // console.log(groupedByAge);
  // Expected output:
  // {
  //   '25': [ { name: 'Alice', age: 25 }, { name: 'Charlie', age: 25 } ],
  //   '30': [ { name: 'Bob', age: 30 } ]
  // }

  const groupedByFirstLetter = Object.groupBy(
    ["apple", "banana", "apricot", "blueberry"],
    (fruit) => fruit[0] ?? "",
  );
  // console.log(groupedByFirstLetter);
  // Expected output:
  // {
  //   a: [ 'apple', 'apricot' ],
  //   b: [ 'banana', 'blueberry' ]
  // }
};
