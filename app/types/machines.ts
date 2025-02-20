export interface Component {
  name: string;
  children: Component[];
  parent: Component | null;
}

export interface Machine {
  name: string;
  components: Component[];
}

export interface MachineLookupResult {
  machine: Machine;
  timestamp: number;
}

export const MachineSchema = {
  name: "string",
  components: [{
    name: "string",
    type: "component",
    hasChildren: true
  }]
} as const;

export const ComponentSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    children: {
      type: "array",
      items: { $ref: "#" }
    }
  },
  required: ["name", "children"]
} as const; 
