var TypeInferer = require('./type-inferer');
var AbstractType = TypeInferer.AbstractType;

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

var J = new AbstractType('J');
var K = new AbstractType('K');
var L = new AbstractType('L');
var M = new AbstractType('M');

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
  'A': [
    [Str]
  ],
  'zero': [
    [Int, Bool]
  ],

  '+': [
    [A, B, X],
    [A, B_, Z],
    [A_, B, X],
    [A_, B_, Y]
  ],
  '*': [
    [X, C, J],
    [X, C_, K],
    [Z, C_, L],
    [Z, C__, M]
  ]
};
var statements = [
  ['*', ['+', 'a', 'b'], 'c']
];

var results = TypeInferer.infer2(signatures, statements);
