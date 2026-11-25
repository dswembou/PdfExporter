
export interface CanvasRubricRating {
  id: string;
  description: string;
  long_description?: string;
  points: number;
}

export interface CanvasRubricCriterion {
  id: string;
  description: string;
  long_description?: string;
  points: number;
  ratings: CanvasRubricRating[];
  criterion_use_range?: boolean;
  ignore_for_scoring?: boolean;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  points_possible: number | null;
  submission_types: string[];
  published: boolean;
  due_at: string | null;
  html_url: string;
  rubric?: CanvasRubricCriterion[];
  use_rubric_for_grading?: boolean;
}

export async function getCanvasAssignment(
  baseUrl: string,
  token: string,
  courseId: string | number,
  assignmentId: number
): Promise<CanvasAssignment> {

  const canvasOrigin = new URL(baseUrl).origin;

  const url = new URL(
    `/api/v1/courses/${encodeURIComponent(courseId)}` +
    `/assignments/${encodeURIComponent(assignmentId)}`,
    canvasOrigin
  );

  const response = await fetch(url, {
    redirect: "error",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Canvas API-fout bij opdracht ${assignmentId}: ${response.status}`
    );
  }

  return response.json() as Promise<CanvasAssignment>;
}
