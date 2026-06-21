// A simple generic stack implementation in TypeScript
// usage:
// const myStack = new Stack<number>();
// myStack.push(10);
// myStack.push(20);
// console.log(myStack.peek()); // Outputs: 20
// console.log(myStack.pop());  // Outputs: 20
// console.log(myStack.size);   // Outputs: 1

export class Stack<T> {
    private items: T[] = [];

    // Add an item to the top
    push(element: T): void {
        this.items.push(element);
    }

    // Remove and return the top item
    pop(): T | undefined {
        return this.items.pop();
    }

    // View the top item without removing it
    peek(): T | undefined {
        return this.items[this.items.length - 1];
    }

    // Check if the stack is empty
    isEmpty(): boolean {
        return this.items.length === 0;
    }

    // Get total number of elements
    get size(): number {
        return this.items.length;
    }
}
