import { pick, set, remove } from 'dot-object';
import Tab from './tab';

export interface Options {
  statesPaths?: string[];
  statesRemove?: string[];
  key?: string;
  onBeforeReplace?(state: any): any;
  onBeforeSave?(state: any): any;
}

export default function(options?: Options) {
  const tab = new Tab(window);
  let key: string = 'vuex-multi-tab';
  let statesPaths: string[] = [];
  let statesRemove: string[] = [];
  let onBeforeReplace = (state: any) => state;
  let onBeforeSave = (state: any) => state;

  if (options) {
    key = options.key ? options.key : key;
    statesPaths = options.statesPaths ? options.statesPaths : statesPaths;
    statesRemove = options.statesRemove ? options.statesRemove : statesRemove;
    onBeforeReplace = options.onBeforeReplace || onBeforeReplace;
    onBeforeSave = options.onBeforeSave || onBeforeSave;
  }

  function filterStates(state: { [key: string]: any }): { [key: string]: any } {
    const result = {};
    statesPaths.forEach(statePath => {
      set(statePath, pick(statePath, state), result);
    });
    return result;
  }

  function removeStates(state: { [key: string]: any }): { [key: string]: any } {
    const result = {};
    statesRemove.forEach(statePath => {
      remove(statePath, pick(statePath, state), result);
    });
    return result;
  }

  /**
   * simple object deep clone method
   * @param obj
   */
  function cloneObj(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(val => cloneObj(val));
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.keys(obj).reduce((r: any, objKey) => {
        r[objKey] = cloneObj(obj[objKey]);
        return r;
      }, {});
    }
    return obj;
  }

  function mergeState(oldState: any, newState: object) {
    // if whole state is to be replaced then do just that
    if (statesPaths.length === 0) return { ...newState };

    // else clone old state
    const merged: any = cloneObj(oldState);

    // and replace only specified paths
    statesPaths.forEach(statePath => {
      const newValue = pick(statePath, newState);
      // remove value if it doesn't exist, overwrite otherwise
      if (typeof newValue === 'undefined') remove(statePath, merged);
      else set(statePath, newValue, merged);
    });
    return merged;
  }

  if (!tab.storageAvailable()) {
    throw new Error('Local storage is not available!');
  }

  function replaceState(store: any, state: object) {
    const adjustedState = onBeforeReplace(state);

    if (adjustedState) {
      store.replaceState(mergeState(store.state, adjustedState));
    }
  }

  return (store: any) => {
    // First time, fetch state from local storage
    tab.fetchState(key, (state: object) => {
      replaceState(store, state);
    });

    // Add event listener to the state saved in local storage
    tab.addEventListener(key, (state: object) => {
      replaceState(store, state);
    });

    store.subscribe((mutation: MutationEvent, state: object) => {
      let toSave = state;

      // Filter state
      if (statesPaths.length > 0) {
        toSave = filterStates(state);
      }

      // Remove state
      if (statesRemove.length > 0) {
        toSave = removeStates(state);
      }

      toSave = onBeforeSave(toSave);

      // Save state in local storage
      if (toSave) {
        tab.saveState(key, toSave);
      }
    });
  };
}
