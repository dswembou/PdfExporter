
export interface AppendixPlacement {
  number: number;
  insertAfterPage: number;
  pageCount: number;
}

export interface OriginalPagePosition {
  originalPage: number;
  finalPage: number;
  offset: number;
}

export interface AppendixPagePosition {
  number: number;
  originalCoverPage: number;
  finalCoverPage: number;
  firstPage: number;
  lastPage: number;
  pageCount: number;
}

export interface PdfPagePositionMap {
  originalPageCount: number;
  insertedPageCount: number;
  totalPageCount: number;
  originalPages: OriginalPagePosition[];
  appendices: AppendixPagePosition[];
}

export function createPdfPagePositionMap(
  originalPageCount: number,
  placements: AppendixPlacement[]
): PdfPagePositionMap {

  if (
    !Number.isInteger(originalPageCount) ||
    originalPageCount < 1
  ) {
    throw new Error(
      "Ongeldig aantal oorspronkelijke pagina's."
    );
  }

  const sortedPlacements = [...placements].sort(
    (a, b) => a.insertAfterPage - b.insertAfterPage
  );

  const usedNumbers = new Set<number>();

  for (const placement of sortedPlacements) {

    if (
      !Number.isInteger(placement.number) ||
      placement.number < 1
    ) {
      throw new Error("Ongeldig bijlagenummer.");
    }

    if (usedNumbers.has(placement.number)) {
      throw new Error(
        `Dubbel bijlagenummer: ${placement.number}`
      );
    }

    usedNumbers.add(placement.number);

    if (
      !Number.isInteger(placement.insertAfterPage) ||
      placement.insertAfterPage < 1 ||
      placement.insertAfterPage > originalPageCount
    ) {
      throw new Error(
        `Ongeldige invoegpositie bij bijlage ${placement.number}.`
      );
    }

    if (
      !Number.isInteger(placement.pageCount) ||
      placement.pageCount < 1
    ) {
      throw new Error(
        `Ongeldig aantal pagina's bij bijlage ${placement.number}.`
      );
    }
  }

  const originalPages: OriginalPagePosition[] = [];

  const appendices: AppendixPagePosition[] = [];

  let insertedPageCount = 0;

  let placementIndex = 0;

  for (
    let originalPage = 1;
    originalPage <= originalPageCount;
    originalPage++
  ) {

    const finalPage =
      originalPage + insertedPageCount;

    originalPages.push({
      originalPage,
      finalPage,
      offset: insertedPageCount
    });

    // Verwerk alle bijlagen die na deze pagina
    // moeten worden ingevoegd.

    while (
      placementIndex < sortedPlacements.length &&
      sortedPlacements[placementIndex].insertAfterPage
        === originalPage
    ) {

      const placement =
        sortedPlacements[placementIndex];

      const firstPage =
        originalPage + insertedPageCount + 1;

      const lastPage =
        firstPage + placement.pageCount - 1;

      appendices.push({
        number: placement.number,
        originalCoverPage: originalPage,
        finalCoverPage: finalPage,
        firstPage,
        lastPage,
        pageCount: placement.pageCount
      });

      insertedPageCount += placement.pageCount;

      placementIndex++;
    }
  }

  return {
    originalPageCount,
    insertedPageCount,
    totalPageCount:
      originalPageCount + insertedPageCount,
    originalPages,
    appendices
  };
}

export function getFinalPageNumber(
  mapping: PdfPagePositionMap,
  originalPage: number
): number {

  if (
    !Number.isInteger(originalPage) ||
    originalPage < 1 ||
    originalPage > mapping.originalPageCount
  ) {
    throw new Error(
      `Ongeldig oorspronkelijk paginanummer: ${originalPage}`
    );
  }

  return mapping.originalPages[
    originalPage - 1
  ].finalPage;
}
