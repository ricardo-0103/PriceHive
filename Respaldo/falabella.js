const searchProductFalabella = async (product) => {
  console.log("inicio Falabella");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.falabella.com.co/falabella-co");
  await page.waitForLoadState("domcontentloaded");

  // Write the product in the search bar
  await page.click("#testId-SearchBar-Input");
  await page.keyboard.type(product);

  // Simulate pressing the Enter key
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "ssFalabella.png" });

  const productsName = [];
  const prices = [];
  const productsImg = [];
  const productsLink = [];
  const productsDescription = [];

  const numberOfElements = await page.$$('b[id^="testId-pod-displaySubTitle"]');

  for (let i = 0; i < numberOfElements.length; i++) {
    await page.screenshot({ path: "ssfalabella.png" });
    console.log("Screenshot tomada");
    await page.waitForSelector('b[id^="testId-pod-displaySubTitle"]');

    //Wait to get the elements title
    const elementsName = await page.$$('b[id^="testId-pod-displaySubTitle"]');

    const elementsPrice = await page.$$(
      ".copy10.primary.medium.jsx-3451706699.normal.line-height-22"
    );

    const elementsName_Link = await page.$$(".jsx-1484439449");

    const elementsImg = await page.$$('div[class^="jsx-2469003054"]');

    //Get the title of the product
    let title = await elementsName[i].evaluate((tit) => tit.textContent.trim());
    title = title.split("|")[0];

    //Check if the title of the element includes the product the user wants
    if (verifyNameProduct(product, title)) {
      productsName.push(title);
      console.log(title);

      //Get the link
      const link = await elementsName_Link[i].evaluate(
        (link) => link.children[0].href
      );
      productsLink.push(link);
      console.log(link);

      // Get the price
      let price = await elementsPrice[i].evaluate((price) =>
        price.textContent.trim()
      );
      price = price.split("-")[0];
      prices.push(price);
      console.log(price);

      //Get the img src
      const src = await elementsImg[i].evaluate((img) => img.children[0].children[0].children[1].src);
      console.log(src);
      productsImg.push(src);

    // Esperar a que al menos un contenedor de producto esté disponible en la página
    await page.waitForSelector('b[id^="testId-pod-displaySubTitle"]');

  
    // const prodDesc_i = await page.$$eval(
    //   ".jsx-4249701670 ul li", // Targeting individual list items (li elements)
    //   (listItems) => {
    //     // Map over each list item and return its text content with newline characters
    //     return listItems.map((item) => {
    //       return item.textContent.trim();
    //     });
    //   }

    // );

    // console.log(prodDesc_i);

    // productsDescription.push(prodDesc_i);

    // Seleccionar todos los contenedores de productos
    const productContainers = await page.$$('b[id^="testId-pod-displaySubTitle"]');

    const productsDescription = [];
  
    for (const container of productContainers) {
      // Buscar el ul dentro del contenedor del producto actual
      const ulElement = await container.$('.jsx-4018082099.section__pod-bottom-description');
  
      if (ulElement) {
        // Capturar los elementos li dentro del ul
        const prodDesc_i = await ulElement.$$eval(
          'li',
          listItems => listItems.map(item => item.textContent.trim())
        );
  
        console.log(prodDesc_i);
        productsDescription.push(prodDesc_i);
      } else {
        console.log('Elemento <ul> no encontrado para este producto.');
      }
    }
  }
    
    //Get only the first 5 products
    if (productsName.length === 5) {
      break;
    }
  }

  // Take a screenshot of the page
  //NOTE: This is just for testing purposes
  await page.screenshot({ path: "ssfalabella.png" });

  await browser.close();
  console.log("Fin Falabella");

  //Create the JSON object of the products
  const products = createJSONObject(
    "Falabella",
    productsName,
    prices,
    productsImg,
    productsDescription,
    productsLink,
    productsName.length
  );
  return products;
};