var util = require('util');

module.exports = {};

// classes to help with types
class AbstractType {
  constructor(type) {
    this.type = type;
  }
}

// work methods 
function infer(functionSignatures, expressions) {

  // annotate the nodes of the expression tree to disambiguate repeated functions
  var labeledExpression = expressions[0]; // only look at the first one for now
  disambiguate(expressions[0], 0);
  console.log('Input expression');
  console.logv(labeledExpression);

  // construct 
  var constraints = {};
  getConstraints(constraints, functionSignatures, labeledExpression);
  console.log('Constraints dictionary');
  console.logv(constraints);

  var inconsistencies = {};
  var validTypeSettings = reconstruct(constraints, labeledExpression, inconsistencies);
  if (Object.keys(validTypeSettings).length === 0) {
    throw {
      'message': 'ERR: inconsistent type constraints.',
      'data': inconsistencies
    };
  }

  console.log('Valid type combinations');
  console.logv(validTypeSettings);

  return validTypeSettings;
}

function disambiguate(expression, id) {
  expression[0] = expression[0] + '#' + id;
  id += 1;
  for (var s = 1; s < expression.length; s++) {
    if (typeof expression[s] === 'string') {
      expression[s] = expression[s] + '#' + id;
      id += 1;
    } else {
      id = disambiguate(expression[s], id);
    }
  }
  return id;
}

function getConstraints(constraints, functionSignatures, expression) {
  if (typeof expression === 'string') {
    // parameter
    return false;
  } else {
    var expressionName = expression[0];
    var functionName = expressionName.substring(0, expressionName.lastIndexOf('#'));
    var signatures = functionSignatures[functionName];

    // get the type restrictions imposed by previous function calls
    var callArity = expression.length - 1; // the arity of this specific call
    var typeRestrictions = null; // null if no restrictions; otherwise, array of valid types 
    if (expressionName in constraints) {
      if ('_' in constraints[expressionName]) {
        // this is a leader, so its constraints are all under the magic key '_'
        typeRestrictions = constraints[expressionName]['_'];
      } else {
        // this is a follower, so its constraints are indexed by its leader's types
        typeRestrictions = {};
        for (var leaderType in constraints[expressionName]) {
          constraints[expressionName][leaderType].forEach((setting) => {
            // we use object keys to ensure uniqueness
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
    
    // record the viable signatures in the constraints entries for each child
    for (var c = 1, st = 0; c < expression.length; c++, st++) {
      var child = expression[c];
      var childName = typeof child === 'string' ? child : child[0];

      // TODO: arbitrary arity
      if (c === 1) { // first child is special
        constraints[childName] = {'_': {}}; // constraints indexed by magic '_'
        for (var signature of viableSignatures) {
          // add type signature[st] to the types of the first child
          constraints[childName]['_'][signature[st].type] = true;
        }
        constraints[childName]['_'] = Object.keys(constraints[childName]['_']);
      } else {
        constraints[childName] = {}; // otherwise, index constraints by the first child's types
        for (var signature of viableSignatures) {
          // the previous child is referred to as the "leader"
          var leaderType = signature[st - 1].type; // the leader's type
          var followerType = signature[st].type; // this child's, the follower's, type
          var expressionType = signature[signature.length - 1].type; // the expression's type
          
          // safely append the [followerType, expressionType] to the follower's constraints
          if (leaderType in constraints[childName]) {
            constraints[childName][leaderType].push([followerType, expressionType]);
          } else {
            constraints[childName][leaderType] = [[followerType, expressionType]];
          }
        }
      }

      // recurse on this child
      getConstraints(constraints, functionSignatures, child);
    }
  }
}

function reconstruct(constraints, expression, err) {
  var reconstruction = {};

  // base case: parameters
  if (typeof expression === 'string') {
    if ('_' in constraints[expression]) {
      constraints[expression]['_'].forEach((type) => {
        reconstruction[type] = [{}]; 
        reconstruction[type][0][expression] = type;
      });
    } else {
      for (var key in constraints[expression]) {
        reconstruction[key] = constraints[expression][key].map((type) => {
          var obj = {};
          obj[expression] = type;
          return obj; 
        });
      }
    }
    return reconstruction;
  }

  // first, reconstruct all the children
  var reconstructedKids = [];
  for (var c = 1; c < expression.length; c++) {
    var child = expression[c];
    var childReconstruction = reconstruct(constraints, child, err);
    if (Object.keys(childReconstruction).length === 0) {
      return {};
    }
    reconstructedKids.push(childReconstruction);
  }

  // make it easier to access the children
  var leader = reconstructedKids[0]; // TODO: arbitrary arity
  if (reconstructedKids.length === 1) return leader;
  var follower = reconstructedKids[1];

  // finally, combine the constructed children
  if (typeof expression[2] === 'string') { // second argument is a parameter -> easy
    for (var leaderType in leader) {
      var followerSettings = follower[leaderType];
      reconstruction = consolidate(
        reconstruction, parameterProduct(leader[leaderType], followerSettings, err)
      );
    }
  } else {
    // get the correspondence dictionary to link the constructed kids together
    var correspondence = constraints[expression[2][0]]; // aka constraint

    // fill in the gaps of follower's reconstruction
    for (var followerType in follower) {
      follower[followerType] = follower[followerType].map((settings) => {
        return [settings, null]; // placeholder for the expression return types
      });
    }

    // use the correspondence information to perform the more complex reconstruction
    for (var leaderType in correspondence) {
      var signaturePartials = correspondence[leaderType];
      for (var signaturePartial of signaturePartials) {
        var followerType = signaturePartial[0];
        var expressionType = signaturePartial[1];

        if (leaderType in leader && followerType in follower) {
          follower[followerType] = follower[followerType].map((settings) => {
            settings[1] = expressionType;
            return settings;
          });

          reconstruction = consolidate(
            reconstruction,
            functionProduct(leader[leaderType], follower[followerType], err)
          );
        }
      }
    }
  } 

  return reconstruction;
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

function parameterProduct(setListA, setListB, err) {
  return product(setListA, setListB, err, function getStrippedSet(set) {
    var setKey = Object.keys(set)[0];
    var setType = set[setKey][0];
    var strippedSet = {};
    strippedSet[setKey] = setType;
    return strippedSet; 
  }, function getReturnType(set) {
    var setKey = Object.keys(set)[0];
    var returnType = set[setKey][1];
    return returnType; 
  });
}

function functionProduct(setListA, setListB, err) {
  return product(setListA, setListB, err, function getStrippedSet(set) {
    return set[0]; 
  }, function getReturnType(set) {
    return set[1]; 
  });
}

function product(setListA, setListB, err, getStrippedSet, getReturnType) {
  var obj = {};

  if (typeof setListA !== 'object' || typeof setListB !== 'object') {
    return obj;
  }

  for (var setA of setListA) {
    for (var setB of setListB) {
      var strippedSetB = getStrippedSet(setB);
      var returnType = getReturnType(setB);

      try {
        var newSetting = merge(setA, strippedSetB);
      } catch (e) {
        // inconsistent constraints
        if (!(e[0] in err)) err[e[0]] = e[1];
        continue;
      }

      if (returnType in obj) {
        obj[returnType].push(newSetting);
      } else {
        obj[returnType] = [newSetting];
      }
    }
  }

  if (Object.keys(obj).length === 0) {
    return {};
  } else return obj;
}

function merge(a, b) {
  var obj = {};

  // console.log('merging ', a, b);

  for (var keyA in a) {
    var index = keyA.lastIndexOf('#');
    var disambiguatedKeyA = keyA;
    if (index !== -1) disambiguatedKeyA = keyA.substring(0, index);
    obj[disambiguatedKeyA] = a[keyA];
  }

  for (var keyB in b) {
    var index = keyB.lastIndexOf('#');
    var disambiguatedKeyB = keyB;
    if (index !== -1) disambiguatedKeyB = keyB.substring(0, index);
    
    var proposedType = obj[disambiguatedKeyB];
    if (disambiguatedKeyB in obj && proposedType !== b[keyB]) {
      throw [disambiguatedKeyB, [proposedType, b[keyB]]];
    } else {
      obj[disambiguatedKeyB] = b[keyB];
    }
  }

  return obj;
}

// helper methods
console.logv = (a) => {
  console.log(util.inspect(a, false, null));
  console.log();
};

// exports
module.exports = {
  infer: infer,
  AbstractType: AbstractType
};

