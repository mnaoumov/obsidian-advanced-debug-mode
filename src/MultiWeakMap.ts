class Node<Value> {
  public map = new Map<unknown, Node<Value>>();
  public value: undefined | Value;

  public weakMap = new WeakMap<object, Node<Value>>();

  public getChildNode(key: unknown): Node<Value> | undefined {
    return isWeakMapKey(key) ? this.weakMap.get(key) : this.map.get(key);
  }

  public getOrCreateChildNode(key: unknown): Node<Value> {
    let childNode = this.getChildNode(key);

    if (childNode) {
      return childNode;
    }

    childNode = new Node();

    if (isWeakMapKey(key)) {
      this.weakMap.set(key, childNode);
    } else {
      this.map.set(key, childNode);
    }

    return childNode;
  }
}

export class MultiWeakMap<Keys extends unknown[], Value> {
  private rootNode = new Node<Value>();

  public get(keys: Keys): undefined | Value {
    let node: Node<Value> | undefined = this.rootNode;

    for (const key of keys) {
      node = node.getChildNode(key);

      if (!node) {
        return undefined;
      }
    }

    return node.value;
  }

  public set(keys: Keys, value: Value): void {
    let node = this.rootNode;

    for (const key of keys) {
      node = node.getOrCreateChildNode(key);
    }

    node.value = value;
  }
}

function isWeakMapKey(key: unknown): key is object {
  return key !== null && (typeof key === 'object' || typeof key === 'function');
}
