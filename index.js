var typeInferer = require('./type-inferer');
var AbstractType = typeInferer.AbstractType;

// program-specific primitive types
var Int = new AbstractType('Int');
var Bool = new AbstractType('Bool');

// function signatures
var signatures = {
  'plus': [Int, Int, Int]
};
var statements = [
  ['plus', 'x', 'y']
];

console.log(Int.getName());
console.log(Bool.getName());
