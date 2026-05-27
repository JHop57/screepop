declare var g: {
  atlas: import("./WorldAtlas").WorldAtlas;
  jobBoard: import("./JobBoard").JobBoard;
};

type Pos = {
  x: number;
  y: number;
  roomName: string;
};
type SimpleStore = { [k in ResourceConstant]?: number };
