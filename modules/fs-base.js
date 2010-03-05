include('io');
include('binary');
require('core/array');

export('canonical',
       'changeWorkingDirectory',
       'workingDirectory',
       'exists',
       'isDirectory',
       'isFile',
       'isReadable',
       'isWritable',
       'join',
       'list',
       'makeDirectory',
       'move',
       'lastModified',
       'open', // TODO: refactor to openRaw as def. in spec.
       'remove',
       'resolve',
       'removeDirectory',
       'size',
       'touch',
       'symbolicLink',
       'hardLink',
       'readLink',
       'isLink',
       'same',
       'sameFilesystem',
       'iterate', // FYI: returns Iterator w/ methods as def. in spec.
       'Permissions',
       'owner',
       'group',
       'changePermissions',
       'changeOwner',
       'changeGroup',
       'permissions');

// For dev.
var adOptionalAttr = [ // These functions are marked as optional in spec.
    'getAttribute',
    'setAttribute',
    'removeAttribute',
    'listAttributeNames'
];

var File = java.io.File,
    FileInputStream = java.io.FileInputStream,
    FileOutputStream = java.io.FileOutputStream;
var SEPARATOR = File.separator;
var SEPARATOR_RE = SEPARATOR == '/' ?
                   new RegExp(SEPARATOR) :
                   new RegExp(SEPARATOR.replace("\\", "\\\\") + "|/");
var POSIX = org.ringojs.util.POSIXSupport.getPOSIX();

function open(path, mode, options) { // TODO: refactor to openRaw as in spec.
    options = checkOptions(mode, options);
    var file = resolveFile(path);
    var {read, write, append, update, binary, charset} = options;
    if (!read && !write && !append && !update) {
        read = true;
    }
    var stream = new Stream(read ?
            new FileInputStream(file) : new FileOutputStream(file, Boolean(append)));
    if (binary) {
        return stream;
    } else if (read || write || append) {
        return new TextStream(stream, charset);
    } else if (update) {
        throw new Error("update not yet implemented");
    }
}

function move(from, to) {
    var source = resolveFile(from);
    var target = resolveFile(to);
    if (!source.renameTo(target)) {
        throw new Error("failed to move file from " + from + " to " + to);
    }
}

function remove(path) {
    var file = resolveFile(path);
    if (!file['delete']()) {
        throw new Error("failed to remove file " + path);
    }
}

function exists(path) {
    var file = resolveFile(path);
    return file.exists();
}

function workingDirectory() {
    return java.lang.System.getProperty('user.dir');
}

function changeWorkingDirectory(path) {
    path = new File(path).getCanonicalPath();
    java.lang.System.setProperty('user.dir', path);
}

function removeDirectory(path) {
    var file = resolveFile(path);
    if (!file['delete']()) {
        throw new Error("failed to remove directory " + path);
    }
}

function list(path) {
    var file = resolveFile(path);
    var list = file.list();
    if (list == null) {
        throw new Error("failed to list directory " + path);
    }
    var result = [];
    for (var i = 0; i < list.length; i++) {
        result[i] = list[i];
    }
    return result;
}

function size(path) {
    var file = resolveFile(path);
    return file.length();
}

function lastModified(path) {
    var file = resolveFile(path);
    return new Date(file.lastModified());
}

function makeDirectory(path) {
    var file = resolveFile(path);
    if (!file.isDirectory() && !file.mkdir()) {
        throw new Error("failed to make directory " + path);
    }
}

function isReadable(path) {
    return resolveFile(path).canRead();
}

function isWritable(path) {
    return resolveFile(path).canWrite();
}

function isFile(path) {
    return resolveFile(path).isFile();
}

function isDirectory(path) {
    return resolveFile(path).isDirectory();
}

function isLink(target) {
    try {
        var stat = POSIX.lstat(target);
        return stat.isSymlink();
    } catch (error) {
        return false;
    }
}

function same(pathA, pathB) {
    try {
        var stat1 = POSIX.stat(pathA);
        var stat2 = POSIX.stat(pathB);
        return stat1.isIdentical(stat2);
    } catch (error) {
        return false;
    }
}

function sameFilesystem(pathA, pathB) {
    try {
        var stat1 = POSIX.stat(pathA);
        var stat2 = POSIX.stat(pathB);
        return stat1.dev() == stat2.dev();
    } catch (error) {
        return false;
    }
}

function canonical(path) {
    return resolveFile(path).getCanonicalPath();
}

function join() {
    return resolve(Array.join(arguments, SEPARATOR));
}

function touch(path, mtime) {
    mtime = mtime || Date.now();
    return resolveFile(path).setLastModified(mtime);
}

function symbolicLink(source, target) {
    return POSIX.symlink(source, target);
}

function hardLink(source, target) {
    return POSIX.link(source, target);
}

function readLink(path) {
    return POSIX.readlink(path);
}

function iterate() {
    // TODO: impl.
}

function Permissions() {
    // TODO: impl.
}

function permissions(path) {
    // TODO: impl.
}

function owner(path) {
    try {
        var uid = POSIX.stat(path).uid();
        var owner = POSIX.getpwuid(uid);
        return owner ? owner.pw_name : uid;
    } catch (error) {
        return null;
    }
}

function group(path) {
    try {
        var gid = POSIX.stat(path).gid();
        var group = POSIX.getgrgid(gid);
        return group ? group.gr_name : gid;
    } catch (error) {
        return null;
    }
}

function changePermissions(path, permissions) {
    // TODO: impl.
}

function changeOwner(path, name) {
    // TODO: impl.
}

function changeGroup(path, name) {
    // TODO: impl.
}

// Adapted from Narwhal.
function resolve() {
    var root = '';
    var elements = [];
    var leaf = '';
    var path;
    for (var i = 0; i < arguments.length; i++) {
        path = String(arguments[i]);
        if (path.trim() == '') {
            continue;
        }
        var parts = path.split(SEPARATOR_RE);
        if (isAbsolute(path)) {
            // path is absolute, throw away everyting we have so far
            root = parts.shift() + SEPARATOR;
            elements = [];
        }
        leaf = parts.pop();
        if (leaf == '.' || leaf == '..') {
            parts.push(leaf);
            leaf = '';
        }
        for (var j = 0; j < parts.length; j++) {
            var part = parts[j];
            if (part == '..') {
                if (elements.length > 0 && elements.peek() != '..') {
                    elements.pop();
                } else if (!root) {
                    elements.push(part);
                }
            } else if (part != '' && part != '.') {
                elements.push(part);
            }
        }
    }
    path = elements.join(SEPARATOR);
    if (path.length > 0) {
        leaf = SEPARATOR + leaf;
    }
    return root + path + leaf;
}

var optionsMask = {
    read: 1,
    write: 1,
    append: 1,
    update: 1,
    binary: 1,
    exclusive: 1,
    canonical: 1,
    charset: 1
};

function checkOptions(mode, options) {
    if (!options) {
        options = {};
    } else if (typeof options != 'object') {
        if (typeof options == 'string') {
            // if options is a mode string convert it to options object
            options = applyMode(options);
        } else {
            throw new Error('unsupported options argument');
        }
    } else {
        // run sanity check on user-provided options object
        for (var key in options) {
            if (!(key in optionsMask)) {
                throw new Error("unsupported option: " + key);
            }
            options[key] = key == 'charset' ?
                    String(options[key]) : Boolean(options[key]);
        }
    }
    if (typeof mode == 'string') {
        // apply mode string to options object
        applyMode(mode, options);
    }
    return options;
}

// apply mode string to options object
function applyMode(mode, options) {
    options = options || {};
    for (var i = 0; i < mode.length; i++) {
        switch (mode[i]) {
        case 'r':
            options.read = true;
            break;
        case 'w':
            options.write = true;
            break;
        case 'a':
            options.append = true;
            break;
        case '+':
            options.update = true;
            break;
        case 'b':
            options.binary = true;
            break;
        case 'x':
            options.exclusive = true;
            break;
        case 'c':
            options.canonical = true;
            break;
        default:
            throw new Error("unsupported mode argument: " + options);
        }
    }
    return options;
}

function resolveFile(path) {
    // Fix for http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4117557
    // relative files are not resolved against workingDirectory/user.dir in java,
    // making the file absolute makes sure it is resolved correctly.
    if (path == undefined) {
        throw new Error('undefined path argument');
    }
    var file = new File(String(path));
    return file.isAbsolute() ? file : file.getAbsoluteFile();
}
