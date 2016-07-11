var TypeInferer = require('./type-inferer');
var AbstractType = TypeInferer.AbstractType;

process.on('uncaughtException', function(err) {
  console.log(err.stack);
});

// program-specific primitive types
var Bool = new AbstractType('Bool');
var Int = new AbstractType('Int');
var Str = new AbstractType('Str');
var Float = new AbstractType('Float');

var A = new AbstractType('A');
var A_ = new AbstractType('A`');
var B = new AbstractType('B');
var B_ = new AbstractType('B`');
var C = new AbstractType('C');
var C_ = new AbstractType('C`');
var C__ = new AbstractType('C``');
var D = new AbstractType('D');
var D_ = new AbstractType('D`');

var K = new AbstractType('K');
var L = new AbstractType('L');
var M = new AbstractType('M');
var N = new AbstractType('N');

var X = new AbstractType('X');
var Y = new AbstractType('Y');
var Z = new AbstractType('Z');

// function signatures
var signatures = {
  'plus': [
    [Int, Int, Int],
    [Int, Float, Float],
    [Float, Int, Float],
    [Float, Float, Float],
    [Str, Str, Str]
  ],

  'substr': [
    [Str, Int, Str],
    [Str, Float, Str],
  ],

  'exp': [
    [Int, Int, Int],
    [Int, Float, Float]
  ],

  'binaryNot': [
    [Int, Int]
  ],

  'truncate': [
    [Float, Int]
  ],

  '(+)': [
    [A, B, L],
    [A, B_, L],
    [A_, B, K]
  ],

  '(-)': [
    [C, D, L],
    [C, D_, M],
    [C_, D, M],
    [B, D, M],
    [C__, D, N]
  ],

  '(*)': [
    [L, L, X],
    [L, M, Y],
    [K, N, Z]
  ]
};
var statements = [
  // ['(*)', ['(+)', 'a', 'b'], ['(-)', 'c', 'd']]
  ['truncate', ['plus', ['binaryNot', 'a'], ['plus', 'b', 'c']]]
];

try {
  var results = TypeInferer.infer(signatures, statements);
} catch (e) {
  console.log(e.message);
  console.log(e.stack);
  console.log(JSON.stringify(e.data));
}
