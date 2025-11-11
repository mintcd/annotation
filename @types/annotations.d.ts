type AnnotationItem = {
  id: string;
  text: string;
  color: string;
  comment?: string;
  created: number;
  lastModified?: number;
  html?: string;
}

type ScriptItem = {
  src?: string;
  content?: string;
  type?: string;
  async?: boolean;
  defer?: boolean;
}

