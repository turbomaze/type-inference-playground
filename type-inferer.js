var util = require('util');

module.exports = {};

console.logv = (a) => {
  console.log(util.inspect(a, false, null));
  console.log();
};

// classes to help with types
class AbstractType {
  constructor(type) {
    this.type = type;
  }
}

function populateTypeDict(typeDict, functionSignatures, statement) {
  if (typeof statement === 'string') {
    // parameter
    return false;
  } else {
    var name = statement[0];
    var signatures = functionSignatures[name];

    // get the type restrictions imposed by previous function calls
    var callArity = statement.length - 1; // the arity of this specific call
    var typeRestrictions = null; // null if no restrictions; otherwise, array of valid types 
    if (name in typeDict) {
      if ('_' in typeDict[name]) {
        typeRestrictions = typeDict[name]['_'];
      } else {
        typeRestrictions = {};
        for (var key in typeDict[name]) {
          typeDict[name][key].forEach((setting) => {
            typeRestrictions[setting[0]] = true;
          });
        }
        typeRestrictions = Object.keys(typeRestrictions);
      }
    }

    // filter out the signatures of this function by 1) arity and 2) type restrictions
    var viableSignatures = signatures;
    if (typeRestrictions !== null) {
      viableSignatures = signatures.filter((signature) => {
        // compare arity
        if (callArity !== signature.length - 1) return false;

        // the signature's return type must be in the typeRestrictions array
        var returnType = signature[signature.length - 1].type;
        return typeRestrictions.indexOf(returnType) !== -1;
      });
    }
    
    // record the viable signatures in the typeDict entries for each child
    for (var c = 1, st = 0; c < statement.length; c++, st++) {
      var child = statement[c];
      var childName = typeof child === 'string' ? child : child[0];

      if (c === 1) { // first child is special
        typeDict[childName] = {_: {}};
        for (var signature of viableSignatures) {
          // add type signature[st] to the types of the first child
          typeDict[childName]['_'][signature[st].type] = true;
        }
        typeDict[childName]['_'] = Object.keys(typeDict[childName]['_']);
      } else {
         // add signature[j] where signature is from annotation of child i to the type dict of child j, indexed by previous children types in signature
        typeDict[childName] = {};
        for (var signature of viableSignatures) {
          // add type signature[st] to the types of the first child
          var key = signature[st - 1].type; // the previous child's value for this signature
          var returnType = signature[signature.length - 1].type;
          if (key in typeDict[childName]) {
            typeDict[childName][key].push([signature[st].type, returnType]);
          } else {
            typeDict[childName][key] = [[signature[st].type, returnType]];
          }
        }
      }

      // recurse on this child
      populateTypeDict(typeDict, functionSignatures, child);
    }
  }
}

function merge(a, b) {
  var obj = {};
  for (var keyA in a) {
    obj[keyA] = a[keyA];
  }
  for (var keyB in b) {
    obj[keyB] = b[keyB];
  }
  return obj;
}

function consolidate(a, b) {
  var obj = {};
  for (var keyA in a) {
    obj[keyA] = a[keyA];
  }
  for (var keyB in b) {
    if (keyB in obj) {
      obj[keyB] = [...obj[keyB], ...b[keyB]];
    } else {
      obj[keyB] = b[keyB];
    }
  }
  return obj;
}

function product(setListA, setListB) {
  var obj = {};
  for (var setA of setListA) {
    for (var setB of setListB) {
      var setBKey = Object.keys(setB)[0];
      var setBType = setB[setBKey][0];
      var returnType = setB[setBKey][1];
      var strippedSetB = {};
      strippedSetB[setBKey] = setBType;
      var newSetting = merge(setA, strippedSetB);
      if (returnType in obj) {
        obj[returnType].push(newSetting);
      } else {
        obj[returnType] = [newSetting];
      }
    }
  }
  return obj;
}

function product2(setListA, setListB) {
  var obj = {};
  for (var setA of setListA) {
    for (var setB of setListB) {
      var strippedSetB = setB[0];
      var returnType = setB[1];
      var newSetting = merge(setA, strippedSetB);
      if (returnType in obj) {
        obj[returnType].push(newSetting);
      } else {
        obj[returnType] = [newSetting];
      }
    }
  }
  return obj;
}

function reconstruct(typeDict, statement) {
  // base case: parameters
  if (typeof statement === 'string') {
    var reconstruction = {};
    if ('_' in typeDict[statement]) {
      typeDict[statement]['_'].forEach((type) => {
        reconstruction[type] = [{}]; 
        reconstruction[type][0][statement] = type;
      });
    } else {
      for (var key in typeDict[statement]) {
        reconstruction[key] = typeDict[statement][key].map((type) => {
          var obj = {};
          obj[statement] = type;
          return obj; 
        });
      }
    }
    return reconstruction;
  }

  // first, reconstruct all the children
  var reconstructedKids = [];
  for (var c = 1; c < statement.length; c++) {
    var child = statement[c];
    reconstructedKids.push(reconstruct(typeDict, child));
  }

  // make it easier to access them
  var reconstructions = {};
  var child0 = reconstructedKids[0]; // TODO: arbitrary arity
  var child1 = reconstructedKids[1];

  // console.log(statement[0]);

  // combine the constructed children
  if (typeof statement[2] !== 'string') {
    // get the correspondence dictionary to link the constructed kids together
    var correspondence = typeDict[statement[2][0]];
    // console.logv(correspondence);

    // use the correspondence information to perform the more complex reconstruction
    for (var key in correspondence) {
      var child1keysToIterate = correspondence[key];
      for (var child1returnType of child1keysToIterate) {

        // console.log('child1');
        child1[child1returnType[0]] = child1[child1returnType[0]].map((settings) => {
          return [settings, child1returnType[1]];
        });
        // console.logv(child1[child1returnType[0]]);
        // console.log('product');
        // console.logv(product2(child0[key], child1[child1returnType[0]]));

        reconstructions = consolidate(
          reconstructions,
          product2(child0[key], child1[child1returnType[0]])
        );
      }
    }
  } else { // second argument is a parameter -> easy
    for (var type0 in child0) {
      var child1Settings = child1[type0];

      reconstructions = consolidate(reconstructions, product(child0[type0], child1Settings));
    }
  }

  return reconstructions;
}

function infer(functionSignatures, statements) {
  var typeDict = {};
  populateTypeDict(typeDict, functionSignatures, statements[0]);
  console.log('type dict');
  console.logv(typeDict);
  var validTypeSettings = reconstruct(typeDict, statements[0]);
  console.log('types');
  console.logv(validTypeSettings);
  return typeDict;
}

module.exports = {
  infer: infer,
  AbstractType: AbstractType
};

