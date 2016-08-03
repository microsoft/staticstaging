/**
 * The run-time support library for WebGL programs. This includes both
 * functions that the compiler emits calls to and utilities that the
 * programmer can invoke themselves.
 *
 * In ideal world, this wouldn't be coupled with the dingus, which is really
 * intended to be a UI. I'd like to refactor it into a separate `glrt`
 * component with its own `package.json` to indicate that it's core run-time
 * support for SCC programs. This should be possible with the "dependency"
 * feature slated for TypeScript 2.1:
 * https://github.com/Microsoft/TypeScript/issues/3469
 */

declare function require(name: string): any;

const pack = require('array-pack-2d');
const eye = require('eye-vector');
const mat4 = require('gl-mat4');
const normals = require('normals');
const obj_loader = require('webgl-obj-loader');

const bunny: Mesh = require('bunny');
const teapot: Mesh = require('teapot');
const snowden: Mesh = require('snowden');

type Vec3Array = [number, number, number][];
type Vec2Array = [number, number][];

/**
 * The type of the sample meshes we use.
 */
interface Mesh {
  positions: Vec3Array;
  cells: Vec3Array;
  texcoords?: Vec2Array;
};

/**
 * Create a WebGL buffer object containing the given data.
 */
function make_buffer(gl: WebGLRenderingContext, data: number[][],
                     type: string, mode: number)
{
  // Initialize a buffer.
  let buf = gl.createBuffer();

  // Flatten the data to a packed array.
  let arr = pack(data, type);

  // Insert the data into the buffer.
  gl.bindBuffer(mode, buf);
  gl.bufferData(mode, arr, gl.STATIC_DRAW);

  return buf;
}

/**
 * Given a flat array, return an array with the elements grouped into
 * sub-arrays of a given size.
 */
function group_array<T>(a: T[], size: number) {
  let out: T[][] = [];
  for (let i = 0; i < a.length; i += size) {
    out.push(a.slice(i, i + size));
  }
  return out;
}

/**
 * The opposite of `group_array`: flatten an array of arrays to a plain array
 * of the element type.
 */
function flat_array<T>(a: T[][]) {
  let out: T[] = [];
  for (let vec of a) {
    for (let el of vec) {
      out.push(el);
    }
  }
  return out;
}

/**
 * Pre-loaded assets for the WebGL demos, keyed by filename.
 */
export type Assets = { [path: string]: string | HTMLImageElement };

/**
 * Get an asset string or throw an error.
 */
function get_asset(assets: Assets, path: string) {
  let asset = assets[path];
  if (!asset) {
    throw `asset not loaded: ${path}`;
  }
  return asset;
}

/**
 * Simple AJAX wrapper for GET requests.
 */
function ajax(url: string, responseType: "text" | "arraybuffer" | "blob" |
              "document" | "json"): Promise<XMLHttpRequest>
{
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.responseType = responseType;
    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          resolve(xhr);
        } else {
          let err = "asset loading failed with status " + xhr.status;
          console.error(err);
          reject(err);
        }
      }
    };
    xhr.open("GET", url);
    xhr.send();
  });
}

/**
 * Get data via AJAX as a string.
 */
function ajax_get(url: string): Promise<string> {
  return ajax(url, "text").then((xhr) => xhr.response);
}

/**
 * Get binary data via AJAX>
 */
function ajax_get_binary(url: string): Promise<ArrayBuffer> {
  return ajax(url, "arraybuffer").then((xhr) => xhr.response);
}

/**
 * Image loader with the DOM's `new Image` API.
 */
function image_get(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let img = new Image();
    img.onload = function() {
      resolve(img);
    }
    img.src = url;
  });
}

/**
 * Image extensions.
 */
const IMAGE_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.gif'];

/**
 * Check whether a path seems to be an image.
 */
function is_image(path: string): boolean {
  for (let ext of IMAGE_EXTENSIONS) {
    let pos = path.length - ext.length;
    if (path.indexOf(ext) === pos) {
      return true;
    }
  }
  return false;
}

/**
 * Load some assets from the server.
 */
export function load_assets(paths: string[], baseurl="assets/"):
  Promise<Assets>
{
  // Kick off async requests for all the assets.
  let requests: Promise<string | HTMLImageElement>[] = [];
  for (let path of paths) {
    let url = baseurl + path;
    if (is_image(path)) {
      requests.push(image_get(url));
    } else {
      requests.push(ajax_get(url));
    }
  }

  // When all return, construct a map from the returned data strings.
  return Promise.all(requests).then((contents) => {
    let assets: Assets = {};
    for (let i = 0; i < paths.length; ++i) {
      assets[paths[i]] = contents[i];
    }
    return assets;
  });
}

/**
 * Get the run-time values to expose to WebGL programs.
 */
export function runtime(gl: WebGLRenderingContext, assets: Assets) {
  return {
    // Operations exposed to the language for getting data for meshes.
    mesh_indices(obj: Mesh) {
      return make_buffer(gl, obj.cells, 'uint16', gl.ELEMENT_ARRAY_BUFFER);
    },
    mesh_positions(obj: Mesh) {
      return make_buffer(gl, obj.positions, 'float32', gl.ARRAY_BUFFER);
    },
    mesh_normals(obj: Mesh) {
      let norm = normals.vertexNormals(obj.cells, obj.positions);
      return make_buffer(gl, norm, 'float32', gl.ARRAY_BUFFER);
    },
    mesh_size(obj: Mesh) {
      return obj.cells.length * obj.cells[0].length;
    },
    mesh_texcoords(obj: Mesh) {
      let coords = obj.texcoords;
      if (!coords) {
        throw "mesh does not have texture coordinates";
      }

      // Create a WebGL buffer.
      let data = flat_array(coords);
      let buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      return buf;
    },

    // And, similarly, a function for actually drawing a mesh. This takes the
    // indices buffer for the mesh and its size (in the number of scalars).
    draw_mesh(indices: WebGLBuffer, size: number) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
      gl.drawElements(gl.TRIANGLES, size, gl.UNSIGNED_SHORT, 0);
    },

    // Sample meshes.
    bunny,
    teapot,
    snowden,

    // Matrix manipulation library.
    mat4,

    // Eye vector calculation.
    eye,

    // Load a mesh from an OBJ file.
    load_obj(name: string) {
      let obj_src = get_asset(assets, name);
      let mesh = new obj_loader.Mesh(obj_src);

      // Match the interface we're using for Mesh objects that come from
      // StackGL.
      return {
        positions: group_array(mesh.vertices, 3),
        cells: group_array(mesh.indices, 3),
        normals: group_array(mesh.vertexNormals, 3),

        // This name I invented -- it's not in the StackGL models.
        texcoords: group_array(mesh.textures, 2),
      };
    },

    /**
     * Load an image asset as a WebGL texture object.
     */
    load_texture(name: string) {
      let img = get_asset(assets, name);
      if (img instanceof HTMLImageElement) {
        let tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
                      gl.UNSIGNED_BYTE, img);

        // No mipmaps.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

        // "Wrap around" the texture on overrun.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

        gl.bindTexture(gl.TEXTURE_2D, null);  // Unbind.

        return tex;
     } else {
        throw "non-image used as image";
      }
    },

    // Create a buffer of values.
    float_array() {
      let arr = new Float32Array(arguments);

      let buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);

      return buf;
    },
  };
}
