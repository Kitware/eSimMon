import {PlotFetcher} from '../src/utils/plotFetcher';
// import {test} from 'jest';


const endpointFn = (itemId: string) => Promise.resolve({steps: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]});
const fastEndpointFn = (itemId: string, timestep: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`itemID: ${itemId} timeStepData: ${timestep}`);
    }, 500);
  });
}
const fetchTimeStepFn = (timestep: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`timeStepData: ${timestep}`);
    }, 500);
  });
}
const logResponse = (promise?: Promise<any>) => {
  if (!promise) {
    console.log("Nothing to resolve.");
    return promise;
  }

  return promise.then(res => {
    console.log("Resolve with value: ", res);
    return res;
  });
}

// test('one-fetcher', () => {
//   return new Promise<void>((resolve) => {
//     const fetcher = new PlotFetcher("0", endpointFn, fastEndpointFn, fetchTimeStepFn);
//     fetcher.initialize().then(res => {
//       fetcher.setCurrentTimestep(7);

//       Promise.all([
//         logResponse(fetcher.getTimestepPlot(7)),
//         logResponse(fetcher.getTimestepPlot(8)),
//         logResponse(fetcher.getTimestepPlot(9)),
//       ]).then(results => {
//         resolve();
//       });
//     });
//   });
// });

test('multi-fetcher', () => {
  return new Promise<void>((resolve) => {
    const N_FETCHERS = 10;
    const fetchers: PlotFetcher[] = [];
    for (let i = 0; i < N_FETCHERS; ++i) {
      fetchers.push(new PlotFetcher(i.toString(), endpointFn, fastEndpointFn, fetchTimeStepFn));
    }

    Promise.all(fetchers.map(fetcher => fetcher.initialize())).then(() => {
      fetchers.forEach(fetcher => fetcher.setCurrentTimestep(2, false));

      // setTimeout(() => fetchers.forEach(fetcher => fetcher.setCurrentTimestep(7, false)), 600);

      // setTimeout(() => fetchers.forEach(fetcher => fetcher.setCurrentTimestep(12, false)), 1100);

      // setTimeout(() => fetchers.forEach(fetcher => fetcher.setCurrentTimestep(2, false)), 1600);

      Promise.all(fetchers.map(fetcher => [
        logResponse(fetcher.getTimestepPlot(2)),
        logResponse(fetcher.getTimestepPlot(3)),
        logResponse(fetcher.getTimestepPlot(4)),

        // logResponse(fetcher.getTimestepPlot(7)),
        // logResponse(fetcher.getTimestepPlot(8)),
        // logResponse(fetcher.getTimestepPlot(9)),

        // logResponse(fetcher.getTimestepPlot(12)),
        // logResponse(fetcher.getTimestepPlot(13)),
        // logResponse(fetcher.getTimestepPlot(14)),
      ]).flat()).then((results) => {
        console.log("Results ", results);
        resolve();
      })
    });
  });
}, 15_000 /* maximum timeout for this test */);
