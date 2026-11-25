
import assert from "node:assert/strict";

import {
  createPdfPagePositionMap,
  getFinalPageNumber
} from "./pdfPagePositionMapper.js";

function main() {

  console.log("Paginapositiemapping testen...");

  // TEST 1: Meerdere bijlagen.

  console.log("\n--- Test 1: Meerdere bijlagen ---");

  const mapping = createPdfPagePositionMap(
    3,
    [
      {
        number: 1,
        insertAfterPage: 2,
        pageCount: 3
      },
      {
        number: 2,
        insertAfterPage: 3,
        pageCount: 4
      }
    ]
  );

  console.table(mapping.originalPages);
  console.table(mapping.appendices);

  assert.equal(mapping.originalPageCount, 3);
  assert.equal(mapping.insertedPageCount, 7);
  assert.equal(mapping.totalPageCount, 10);

  assert.equal(getFinalPageNumber(mapping, 1), 1);
  assert.equal(getFinalPageNumber(mapping, 2), 2);
  assert.equal(getFinalPageNumber(mapping, 3), 6);

  assert.equal(mapping.appendices[0].firstPage, 3);
  assert.equal(mapping.appendices[0].lastPage, 5);

  assert.equal(mapping.appendices[1].finalCoverPage, 6);
  assert.equal(mapping.appendices[1].firstPage, 7);
  assert.equal(mapping.appendices[1].lastPage, 10);

  console.log("Test 1 geslaagd.");

  // TEST 2: Geen bijlagen.

  console.log("\n--- Test 2: Geen bijlagen ---");

  const withoutAppendices =
    createPdfPagePositionMap(10, []);

  assert.equal(
    withoutAppendices.totalPageCount,
    10
  );

  for (let page = 1; page <= 10; page++) {

    assert.equal(
      getFinalPageNumber(withoutAppendices, page),
      page
    );
  }

  console.log("Test 2 geslaagd.");

  // TEST 3: Meerdere bijlagen op dezelfde positie.

  console.log(
    "\n--- Test 3: Gelijke invoegposities ---"
  );

  const samePosition = createPdfPagePositionMap(
    5,
    [
      {
        number: 1,
        insertAfterPage: 2,
        pageCount: 3
      },
      {
        number: 2,
        insertAfterPage: 2,
        pageCount: 4
      }
    ]
  );

  assert.equal(samePosition.totalPageCount, 12);

  assert.equal(
    samePosition.appendices[0].firstPage,
    3
  );

  assert.equal(
    samePosition.appendices[0].lastPage,
    5
  );

  assert.equal(
    samePosition.appendices[1].firstPage,
    6
  );

  assert.equal(
    samePosition.appendices[1].lastPage,
    9
  );

  assert.equal(
    getFinalPageNumber(samePosition, 3),
    10
  );

  console.log("Test 3 geslaagd.");

  // TEST 4: Groot lesboek.

  console.log("\n--- Test 4: Groot lesboek ---");

  const largeDocument = createPdfPagePositionMap(
    205,
    [
      {
        number: 1,
        insertAfterPage: 100,
        pageCount: 15
      },
      {
        number: 2,
        insertAfterPage: 150,
        pageCount: 25
      },
      {
        number: 3,
        insertAfterPage: 205,
        pageCount: 10
      }
    ]
  );

  assert.equal(largeDocument.totalPageCount, 255);

  assert.equal(
    getFinalPageNumber(largeDocument, 100),
    100
  );

  assert.equal(
    getFinalPageNumber(largeDocument, 101),
    116
  );

  assert.equal(
    getFinalPageNumber(largeDocument, 150),
    165
  );

  assert.equal(
    getFinalPageNumber(largeDocument, 151),
    191
  );

  assert.equal(
    getFinalPageNumber(largeDocument, 205),
    245
  );

  assert.equal(
    largeDocument.appendices[2].lastPage,
    255
  );

  console.log("Test 4 geslaagd.");

  // TEST 5: Ongeldige invoer.

  console.log("\n--- Test 5: Ongeldige invoer ---");

  assert.throws(() =>
    createPdfPagePositionMap(0, [])
  );

  assert.throws(() =>
    createPdfPagePositionMap(3, [
      {
        number: 1,
        insertAfterPage: 4,
        pageCount: 2
      }
    ])
  );

  assert.throws(() =>
    createPdfPagePositionMap(3, [
      {
        number: 1,
        insertAfterPage: 2,
        pageCount: 0
      }
    ])
  );

  assert.throws(() =>
    createPdfPagePositionMap(3, [
      {
        number: 1,
        insertAfterPage: 1,
        pageCount: 2
      },
      {
        number: 1,
        insertAfterPage: 2,
        pageCount: 2
      }
    ])
  );

  assert.throws(() =>
    getFinalPageNumber(mapping, 4)
  );

  console.log("Test 5 geslaagd.");

  console.log("\nAlle 5 tests succesvol afgerond!");
}

try {
  main();
} catch (error) {
  console.error("Fout:", error);
  process.exitCode = 1;
}
