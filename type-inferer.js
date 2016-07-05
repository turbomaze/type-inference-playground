var exports = module.exports = {};

class AbstractType {
  constructor(name) {
    this.name = name;
  }

  getName() {
    return this.name;
  }
}

function infer(a) {
  return 'inferred';
}

exports.infer = infer;
exports.AbstractType = AbstractType;
