declare let g: {
  atlas: import("./WorldAtlas").WorldAtlas;
  jobBoard: import("./JobBoard").JobBoard;
  hud: import("./utils/Hud").default;
};

interface Pos {
  x: number;
  y: number;
  roomName: string;
}
type SimpleStore = { [k in ResourceConstant]?: number };
