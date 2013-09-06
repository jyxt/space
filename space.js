function Space(properties) {
  
  this.keys = []
  this.values = {}
  this.events = {}
  this._parse(properties)
  return this
}

Space.pathBranch = function (xpath) {
  var nodes = xpath.split(/ /g)
  if (nodes.length < 2)
    return ''
  nodes.pop()
  return nodes.join(' ')
}

Space.pathLeaf = function (xpath) {
  var nodes = xpath.split(/ /g)
  if (nodes.length < 2)
    return xpath
  return nodes[nodes.length - 1]
}

/**
 * @param {string}
 * @param {int}
 * @return {string}
 */
Space.strRepeat = function (string, count) {
  var str = ''
  for (var i = 0; i < count; i++) {
    str += ' '
  }
  return str
}

/**
 * Return a new Space with the key/value pairs that all passed spaces contain.
 * space: will probably be removed.
 * @param {array} Array of Spaces
 * @return {Space}
 */
Space.union = function () {
  var union = Space.unionSingle(arguments[0], arguments[1])
  for (var i in arguments) {
    if (i === 1) continue // skip the first one
    union = Space.unionSingle(union, arguments[i])
    if (!union.length()) break
  }
  return union
}

/**
 * space: will probably be removed.
 * @param {Space}
 * @return {Space}
 */
Space.unionSingle = function(spaceA, spaceB) {
  var union = new Space()
  if (!(spaceB instanceof Space))
    return union
  for (var i in spaceA.keys) {
    var key = spaceA.keys[i]
    var value = spaceA.getByKey(key)
    if (value instanceof Space && spaceB.getByKey(key) && spaceB.getByKey(key) instanceof Space)
      union._set(key, Space.unionSingle(value, spaceB.getByKey(key)))
    if (value === spaceB.getByKey(key))
      union._set(key, value)
  }
  return union
}

Space.prototype.keys = []
Space.prototype.values = {}

Space.prototype.append = function (key, value) {
  this._set(key, value)
  this.trigger('append', key, value)
  this.trigger('change')
  return this
}

/**
 * Deletes all keys and values.
 * @return this
 */
Space.prototype._clear = function () {
  this.keys = []
  this.values = {}
  return this
}

/**
 * Deletes all keys and values.
 * @return this
 */
Space.prototype.clear = function (space) {
  if (this.isEmpty())
    return this
  this._clear()
  this.trigger('clear')
  if (space)
    this._parse(space)
  this.trigger('change')
  return this
}

/**
 * Returns a deep copied space.
 * @return {Space}
 */
Space.prototype.clone = function () {
  return new Space(this.toString())
}

Space.prototype.create = function (key, value) {
  this._set(key, value)
  this.trigger('create', key, value)
  this.trigger('change')
  return this
}

Space.prototype._delete = function (key) {
  if (!key.toString().match(/ /)) {
    var index = this.keys.indexOf(key)
    if (index === -1)
      return 0
    this.keys.splice(index, 1)
    delete this.deleteByKey(key)
    return 1
  }
  // Get parent
  var parts = key.split(/ /)
  var child = parts.pop()
  var parent = this.get(parts.join(' '))
  if (parent instanceof Space)
    return parent._delete(child)
  return 0
}

Space.prototype['delete'] = function (key) {
  if (this._delete(key))
    this.trigger('delete', key)
  this.trigger('change')
  return this
}

Space.prototype.deleteByKey = function (key) {
  delete this.values[key]
}

/**
 * Returns the difference between 2 spaces. The difference between 2 spaces is a space.
 *
 * b == a.patch(a.diff(b))
 *
 * todo: clean and refactor this.
 *
 * @param {Space} The space to compare the instance against.
 * @return {Space}
 */
Space.prototype.diff = function (space) {

  var diff = new Space()
  
  if (!(space instanceof Space))
    space = new Space(space)
  
  for (var i in this.keys) {
    
    var key = this.keys[i]
    var value = space.getByKey(key)
    // Case: Deleted
    if (typeof value === 'undefined') {
      diff._set(key, '')
      continue
    }
    // Different Types
    if (typeof(this.getByKey(key)) !== typeof(value)) {
      if (typeof value === 'object')
        diff._set(key, new Space(value))
      
      // We treat a value of 1 equal to '1'
      else if (this.getByKey(key) == value)
        continue
      else
        diff._set(key, value)
      continue
    }
    // Strings, floats, etc
    if (typeof(this.getByKey(key)) !== 'object') {
      if (this.getByKey(key) != value)
        diff._set(key, value)
      continue
    }
    // Both are Objects
    var sub_diff = this.getByKey(key).diff(value)
    if (sub_diff.keys.length)
      diff._set(key, sub_diff)
  }
  // Leftovers are Additions
  for (var i in space.keys) {
    var key = space.keys[i]
    var value = space.getByKey(key)
    if (this.has(key))
      continue
    if (typeof value !== 'object') {
      diff._set(key, value)
      continue
    }
    else if (value instanceof Space)
      diff._set(key, new Space(value))
    else
      diff._set(key, new Space(space))
  }
  return diff
}

/**
 * @param {space}
 * @return {space} Returns empty space if order is equal.
 */
Space.prototype.diffOrder = function (space) {

  if (!(space instanceof Space))
    space = new Space(space)
  var diff = new Space()
  for (var i in space.keys) {
    var key = space.keys[i]
    var value = space.getByKey(key)
    if (!(value instanceof Space) || !(this.getByKey(key) instanceof Space))
      continue
    var childDiff = this.getByKey(key).diffOrder(value)
    if (childDiff.isEmpty())
      continue
    diff._set(key, childDiff)
  }
  // Parent hasnt changed
  if (space.keys.join(' ') === this.keys.join(' '))
    return diff
  // Parent has changed
  diff.keys = space.keys
  for (var i in space.keys) {
    var key = space.keys[i]
    if (!diff.has(key))
      diff.setValue(key, new Space())
  }
  return diff
}

Space.prototype.each = function (fn) {
  for (var i in this.keys) {
    var key = this.keys[i]
    if (fn.call(this, key, this.getByKey(key)) === false)
      return this
  }
  return this
}

Space.prototype.find = function (keyTest, valueTest) {
  // for now assume string test
  // search this one
  var matches = new Space()
  if (this.get(keyTest) === valueTest)
    matches.push(this)
  this.each(function (key, value) {
    if (!(value instanceof Space))
      return true
    value
      .find(keyTest, valueTest)
      .each(function (k, v) {
        matches.push(v)    
      })
  })
  return matches
}

Space.prototype.every = function (fn) {
  for (var i in this.keys) {
    var key = this.keys[i]
    var value = this.getByKey(key)
    if (value instanceof Space)
      value.every(fn)
    fn.call(this, key, this.getByKey(key))
  }
  return this
}

/**
 * Search the space for a given path (xpath).
 * @param {string|int|space}
 * @param {space}
 * @return The matching value
 */
Space.prototype.get = function (query) {
  switch (typeof query) {
    case "string":
      return this.getByString(query)
    break
    case "object":
      return this.getBySpace(query)
    break
    case "number":
      return this.getByInt(query)
    break
  }
  return null
}

/**
 * @param {int}
 * @return The matching value
 */
Space.prototype.getByInt = function (index) {
  if (index < 0)
    index = this.keys.length + index
  var key = this.keys[index]
  return this.getByKey(key)
}

Space.prototype.getByKey = function (key) {
  return this.values[key]
}

/**
 * Search the space for a given path (xpath).
 * @param {string}
 * @return The matching value
 */
Space.prototype.getByString = function (xpath) {
  
  if (!xpath)
    return undefined
  if (!xpath.match(/ /))
    return this.getByKey(xpath)
  var parts = xpath.split(/ /g)
  var current = parts.shift()
  
  // Not set
  if (!this.has(current))
    return undefined
  
  if (this.getByKey(current) instanceof Space)
    return this.getByKey(current).get(parts.join(' '))
  
  else
    return undefined
}

/**
 * Recursively retrieve properties.
 * @param {space} 
 * @return Space
 */
Space.prototype.getBySpace = function (space) {
  var result = new Space()
  
  for (var i in space.keys) {
    var key = space.keys[i]
    var value = this.getByKey(key)
    
    // If this doesnt have that property, continue
    if (typeof value === 'undefined')
      continue
    
    // If the request is a leaf or empty space, set
    if (!(space.getByKey(key) instanceof Space) || !space.getByKey(key).keys.length) {
      result._set(key, value)
      continue
    }
    
    // Else the request is a space with keys, make sure the subject is a space
    if (!(value instanceof Space))
      continue
    
    // Now time to recurse
    result._set(key, value.getBySpace(space.getByKey(key)))
  }
  return result 
}

Space.prototype.getTokens = function (debug) {
  
  var string = this.toString()
  var mode = 'K'
  var tokens = ''
  var escapeLength = 1
  var escaping = 0
  for (var i = 0; i < string.length - 1; i++) {
    var character = string.substr(i, 1)
    if (debug)
      console.log('map: %s; mode: %s; char: %s', tokens, mode, character)

    if (escaping > 0) {
    // skip over the escaped spaces
      tokens += 'E'
      escaping--
      continue
    }
    
    if (character !== ' ' && character !== '\n') {
      if (mode === 'N')
        mode = 'K'
      tokens += mode
      continue
    }
    
    if (character === ' ') {
      
      if (mode === 'V') {
        tokens += mode
        continue
      }
      
      else if (mode === 'K') {
        tokens += 'S'
        mode = 'V'
        continue        
      }
      
      // KEY hunt mode
      else {
        escapeLength++
        tokens += 'N'
        continue
      }
      
    }
    
    //  else its a newline
    
    if (mode === 'K') {
      mode = 'N'
      escapeLength = 1
      tokens += 'N'
      continue
    }
    
    else if (mode === 'V') {
      
      // if is escaped
      if (string.substr(i + 1, escapeLength) === Space.strRepeat(' ', escapeLength)) {
        tokens += 'V'
        escaping = escapeLength
        continue
      }
      
      // else not escaped
      mode = 'N'
      escapeLength = 1
      tokens += 'N'
      continue
      
      
    }
  
  }
  
  return tokens
  
}

Space.prototype.getTokensConcise = function () {
  // http://stackoverflow.com/questions/7780794/javascript-regex-remove-duplicate-characters
  return this.getTokens().replace(/[^\w\s]|(.)(?=\1)/gi, "")
}

Space.prototype.has = function (key) {
  return this.values[key] !== undefined
}

Space.prototype.isEmpty = function () {
  return this.keys.length === 0
}

Space.prototype.keyCount = function () {
  var count = this.length()
  this.each(function (key, value) {
    if (value instanceof Space)
      count += value.keyCount()
  })
  return count
}

/**
 * @return int
 */
Space.prototype.length = function () {
  return this.keys.length
}

/**
 * Return the next name in the Space, given a name.
 * @param {string}
 * @return {string}
 */
Space.prototype.next = function (name) {
  var index = this.keys.indexOf(name) + 1
  if (this.keys[index])
    return this.keys[index]
  return this.keys[0]
}

Space.prototype.off = function (eventName, fn) {
  if (!this.events[eventName])
    return true
  for (var i in this.events[eventName]) {
    if (this.events[eventName][i] === fn)
      this.events[eventName].splice(i, 1)
  }
}

Space.prototype.objectCount = function () {
  var count = 0
  this.each(function (key, value) {
    if (value instanceof Space)
      count += 1 + value.objectCount()
  })
  return count
}

Space.prototype.on = function (eventName, fn) {
  
  if (!this.events[eventName])
    this.events[eventName] = []
  this.events[eventName].push(fn)
}

Space.prototype._parse = function (properties) {
  
  // Load from string
  if (typeof properties === 'string')
    return this._parseFromString(properties)
  
  // Load from Space object
  if (properties instanceof Space) {
    this.keys = properties.keys
    for (var i in this.keys) {
      var key = this.keys[i]
      this.setValue(key, properties.getByKey(key))
    }
    return this
  }
  
  // Load from object
  for (var key in properties) {
    if (!Object.prototype.hasOwnProperty.call(properties, key))
//    if (!properties.hasOwnProperty(key))
      continue
    var value = properties[key]
    if (typeof value === 'object')
      this._set(key, new Space(value))
    else
      this._set(key, value)
  }
}

/**
 * Construct the Space from a string.
 * @param {string}
 * @return {Space}
 */
Space.prototype._parseFromString = function (string) {
  
  // Space always start on a key. Eliminate whitespace at beginning of string
  string = string.replace(/^[\n ]*/, '')
  
  /** Eliminate Windows \r characters and newlines at end of string.*/
  string = string.replace(/\n\r/g, '\n').replace(/\r\n/g, '\n')
  
  /** Eliminate newlines at end of string.*/
  string = string.replace(/\n[\n ]*$/, '')
  
  /** Space doesn't have useless lines*/
  string = string.replace(/\n\n+/, '\n')
  
  // Workaround for browsers without negative look ahead
  /*
  var spaces_without_delimiter = string.split(/\n([^ ])/),
      spaces = [spaces_without_delimiter[0]]
  
  // Now we recombine spaces.
  for (var i = 1; i < spaces_without_delimiter.length; i = i + 2) {
    spaces.push(spaces_without_delimiter[i] + spaces_without_delimiter[i+1])
  }
  */
  var spaces = string.split(/\n(?! )/g)
  var matches
  for (var i in spaces) {
    var space = spaces[i]
    if (matches = space.match(/^([^ ]+)(\n|$)/)) // Space
      this._set(matches[1], new Space(space.substr(matches[1].length).replace(/\n /g, '\n')))
    else if (matches = space.match(/^([^ ]+) /)) // Leaf
      this._set(matches[1], space.substr(matches[1].length + 1).replace(/^\n /, '').replace(/\n /g, '\n') )
  }
  return this
}

/**
 * Apply a patch to the Space instance.
 * @param {Space|string}
 * @return {Space}
 */
Space.prototype._patch = function (patch) {
  
  if (!(patch instanceof Space))
    patch = new Space(patch)
  
  for (var i in patch.keys) {
    var key = patch.keys[i]
    var patchValue = patch.getByKey(key)

    // If patch value is a string, doesnt matter what type subject is.
    if (typeof patchValue === 'string') {
      if (patchValue === '')
        this._delete(key)
      else
        this._set(key, patchValue)
      continue
    }
    
    // If patch value is an int, doesnt matter what type subject is.
    if (typeof patchValue === 'number') {
      this._set(key, patchValue)
      continue
    }
    
    // If its an empty space, delete patch.
    if (patchValue instanceof Space && !patchValue.length()) {
      this._delete(key)
      continue
    }
    
    // If both subject value and patch value are Spaces, do a recursive patch.
    if (this.getByKey(key) instanceof Space) {
      this.getByKey(key)._patch(patchValue)
      continue
    }
    
    // Final case. Do a deep copy of space.
    this._set(key, new Space(patchValue))
  }
  return this
}

Space.prototype.patch = function (patch) {
  // todo, don't trigger patch if no change
  this._patch(patch)
  this.trigger('patch', patch)
  this.trigger('change')
  return this
}

/**
 * Change the order of the keys
 * @param {array|string}
 * @return {this}
 */
Space.prototype._patchOrder = function (space) {
  
  if (!(space instanceof Space))
    space = new Space(space)
  
  // make sure space has all keys
  var keys = this.length()
  for (var i in space.keys) {
    var key = space.keys[i]
    // If the keys differ a bit, skip this level
    if (!this.has(key))
      break
    keys--
  }
  if (keys === 0) {
    // Reorder this level.
    this.keys = space.keys
  }
  for (var i in space.keys) {
    var key = space.keys[i]
    var value = space.getByKey(key)
    if (value instanceof Space && value.length() && this.getByKey(key) instanceof Space)
      this.getByKey(key)._patchOrder(value)
  }
  return this
}

Space.prototype.patchOrder = function (space) {
  // todo: don't trigger event if no change
  this._patchOrder(space)
  this.trigger('patchOrder', space)
  this.trigger('change')
  return this
}

Space.prototype.pop = function () {
  if (!this.length())
    return null
  var key = this.keys.pop()
  var result = new Space()
  result.set(key, this.get(key))
  this._delete(key)
  return result
}

/**
 * Return the previous name in the Space, given a name.
 * @param {string}
 * @return {string}
 */
Space.prototype.prev = function (name) {
  var index = this.keys.indexOf(name) - 1
  if (index >= 0)
    return this.keys[index]
  return this.keys[this.length() - 1]
}

Space.prototype.push = function (value) {
  var i = this.length()
  while (this.get(i.toString())) {
    i++
  }
  this._set(i.toString(), value)
  return this
}

Space.prototype._rename = function (oldName, newName) {
  this.setValue(newName, this.getByKey(oldName))
  this.deleteByKey(oldName)
  this.keys[this.keys.indexOf(oldName)] = newName
  return this
}

Space.prototype.rename = function (oldName, newName) {
  var branch = Space.pathBranch(oldName)
  var leaf = Space.pathLeaf(oldName)
  var newLeaf = newName
  var space = this
  if (branch) {
    space = this.get(branch)
    newLeaf = newName.substr(branch.length + 1)
  }
  space._rename(leaf, newLeaf)
  if (oldName !== newName)
    this.trigger('rename', oldName, newName)
  this.trigger('change')
  return this
}

/**
 * Search the space for a given path (xpath).
 * @param {string}
 * @param {space}
 * @param {int} Optional index to insert at
 * @return The matching value
 */
Space.prototype._set = function (key, value, index) {
  if (!key)
    return null
  var steps = key.toString().split(/ /g)
  var context = this
  var step
  while (step = steps.shift()) {
    var newValue
    if (!context.has(step)) {
      if (typeof index === 'number')
        context.keys.splice(index, 0, step)
      else
        context.keys.push(step)
    }
    // Leaf
    if (!steps.length)
      context.setValue(step, value)
    else if (!(context.getByKey(step) instanceof Space))
      context.setValue(step, new Space())
    context = context.getByKey(step)
  }
  return this
}

Space.prototype.set = function (key, value, index) {
  var isUpdate = !!this.get(key)
  this._set(key, value, index)
  this.trigger('set', key, value, index)
  this.trigger('change')
  return this
}

Space.prototype.setValue = function (key, value) {
  this.values[key] = value
}

Space.prototype.shift = function () {
  if (!this.length())
    return null
  var key = this.keys.shift()
  var result = new Space()
  result.set(key, this.get(key))
  this._delete(key)
  return result
}

/**
 * Return executable javascript code.
 * @return {string}
 */
Space.prototype.toJavascript = function () {
  return 'new Space(\'' + this.toString().replace(/\n/g, '\\n').replace(/\'/g, '\\\'') + '\')'
}

/**
 * Return JSON
 * @return {string}
 */
Space.prototype.toJSON = function () {
  return JSON.stringify(this.toObject())
}

/**
 * Returns a regular javascript object
 * @return {object}
 */
Space.prototype.toObject = function () {
  var obj = {}
  for (var i in this.keys) {
    var key = this.keys[i]
    var value = this.getByKey(key)
    if (value instanceof Space)
      obj[key] = value.toObject()
    else
      obj[key] = value
  }
  return obj
}

/**
 * @return {string}
 */
Space.prototype.toString =  function (spaces) {
  spaces = spaces || 0
  var string = ''
  // Iterate over each property
  for (var i in this.keys) {
    
    var key = this.keys[i]
    var value = this.getByKey(key)

    // If property value is undefined
    if (typeof value === 'undefined') {
      string += '\n'
      continue
    }

    // Set up the key part of the key/value pair
    string += Space.strRepeat(' ', spaces) + key
    
    // If the value is a space, concatenate it
    if (value instanceof Space)
      string += '\n' + value.toString(spaces + 1)
    
    // If an object (other than class of space) snuck in there
    else if (typeof value === 'object')
      string += '\n' + new Space(value).toString(spaces + 1)
    
    // dont put a blank string on blank values.
    else if (value.toString() === '')
      string += ' \n'
    
    // multiline string
    else if (value.toString().match(/\n/))
      string += ' \n' + Space.strRepeat(' ', spaces + 1) + value.toString().replace(/\n/g, '\n' + Space.strRepeat(' ', spaces + 1)) + '\n'
    
    // Plain string
    else
      string += ' ' + value.toString() + '\n'
  }
  return string
}

Space.prototype.toURL = function () {
  return encodeURIComponent(this.toString())
}

Space.prototype.trigger = function (eventName) {
  if (!this.events[eventName])
    return true
  var args = Array.prototype.slice.call(arguments)
  for (var i in this.events[eventName]) {
    this.events[eventName][i].apply(this, args.slice(1))
  }
}

// Export Space for use in Node.js
if (typeof exports != 'undefined')
  module.exports = Space;


