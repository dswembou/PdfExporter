
export interface CanvasDiscussion {

  id: number;

  title: string;

  message: string | null;

  html_url: string;

  discussion_type: string;

  published: boolean;

  locked: boolean;

  locked_for_user: boolean;

  require_initial_post?: boolean;

  allow_rating?: boolean;

  assignment_id?: number | null;

  posted_at?: string | null;

  delayed_post_at?: string | null;

  lock_at?: string | null;

  discussion_subentry_count?: number;
}

export async function getCanvasDiscussion(
  baseUrl: string,
  token: string,
  courseId: string | number,
  discussionId: number
): Promise<CanvasDiscussion> {

  const canvasOrigin = new URL(baseUrl).origin;

  const url = new URL(
    `/api/v1/courses/${encodeURIComponent(courseId)}` +
    `/discussion_topics/${encodeURIComponent(discussionId)}`,
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
      `Canvas API-fout bij discussie ${discussionId}: ` +
      `${response.status}`
    );
  }

  return response.json() as Promise<CanvasDiscussion>;
}
