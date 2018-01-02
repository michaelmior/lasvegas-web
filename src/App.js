import React, { Component } from 'react';
import './App.css';

import Client from 'boardgame.io/client';
import Game from 'boardgame.io/game';

import { cloneDeep, countBy, map, max, range, shuffle, some, sum, sumBy } from 'lodash';

// const MAX_DICE = 8;
// const MAX_ROUNDS = 4;

const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const MAX_DICE = 1;
const MAX_ROUNDS = 1;

const LasVegas = Game({
  setup: (numPlayers) => DealBills({
    bills: range(6).map(() => []),
    deck: shuffle([
            Array(5).fill(60),
            Array(5).fill(70),
            Array(5).fill(80),
            Array(5).fill(90),
            Array(6).fill(10),
            Array(6).fill(40),
            Array(6).fill(50),
            Array(8).fill(20),
            Array(8).fill(30)
          ].reduce((a, b) => a.concat(b), [])),
    dice: range(6).map(() => Array(numPlayers).fill(0)),
    roll: null,
    round: 0,
    scores: Array(numPlayers).fill(0)
  }),

  moves: {
    dealBills(G, ctx) {
      return DealBills(G);
    },

    endRound(G, ctx) {
      let scores = Scores(G, ctx);

      return {
        ...G,
        bills: range(6).map(() => []),
        dice: range(6).map(() => Array(ctx.numPlayers).fill(0)),
        roll: null,
        round: G.round + 1,
        scores: map(G.scores, (s, i) => s + scores[i])
      };
    },

    rollDice(G, ctx) {
      const remainingDice = RemainingDice(G, ctx.currentPlayer);
      const dice = range(remainingDice).map(() => Math.floor(Math.random() * 6));
      const counts = countBy(dice);

      return  {...G, roll: range(6).map((i) => counts[i] || 0)};
    },

    selectDie(G, ctx, num) {
      let dice = cloneDeep(G.dice);
      dice[num][ctx.currentPlayer] += G.roll[num];

      let newG = {...G, dice, roll: null};
      console.log(JSON.stringify(newG));
      return newG;
    }
  },

  victory: (G, ctx) => {
    const maxScore = max(G.scores);
    const hasWinner = G.round === MAX_ROUNDS &&
                      countBy(G.scores)[maxScore] === 1;
    return hasWinner ? G.scores.indexOf(maxScore) : null;
  }
});

function DealBills(G) {
  let deck = [...G.deck];
  let bills = [...G.bills];

  for (let i = 0; i < 6; i++) {
    while (sum(bills[i]) < 50) {
      bills[i].push(deck.pop());
    }

    bills[i].sort().reverse();
  }

  return {...G, bills, deck};
}

function RemainingDice(G, player) {
  return MAX_DICE - sumBy(G.dice, (cur) => cur[player]);
}

function Scores(G, ctx) {
  let scores = Array(ctx.numPlayers).fill(0);
  for (let i = 0; i < 6; i++) {
    let bills = [...G.bills[i]];
    let dice = [...G.dice[i]];
    while (some(dice, (d) => d > 0)) {
      const maxCount = max(dice);
      if (countBy(dice)[maxCount] !== 1) {
        // If there is a tie, discount those dice
        dice = dice.map((d) => d === maxCount ? 0 : d);
      } else {
        // Otherwise award the next highest bill to the player
        let player = dice.indexOf(maxCount);
        scores[player] += bills.shift();
        dice[player] = 0;
      }
    }
  }

  return scores;
}

class LasVegasBoard extends React.Component {
  onClick(die) {
    if (this.isActive(die)) {
      console.log(this.props.ctx.currentPlayer + ' has ' + RemainingDice(this.props.G, this.props.ctx.currentPlayer) + ' dice remaining');
      console.log(JSON.stringify(this.props.G.dice));
      this.props.moves.selectDie(die);
      console.log(this.props.ctx.currentPlayer + ' has ' + RemainingDice(this.props.G, this.props.ctx.currentPlayer) + ' dice remaining');
      console.log(JSON.stringify(this.props.G.dice));
      this.props.endTurn();

      // If the game is not over, skip players with no remaining dice
      if (this.props.round !== MAX_ROUNDS) {
        // Skip over any players without remaining dice
        let skipped = 0;
        console.log(this.props.ctx.currentPlayer + ' has ' + RemainingDice(this.props.G, this.props.ctx.currentPlayer) + ' dice remaining');
        while (RemainingDice(this.props.G, this.props.ctx.currentPlayer) === 0 &&
               skipped <= this.props.ctx.numPlayers) {
          console.log('Skipping ' + this.props.ctx.currentPlayer);
          this.props.endTurn();
          skipped++;
        }

        console.log(skipped + ' player skipped');

        // Check if we should advance the round
        if (skipped === this.props.ctx.numPlayers) {
          this.props.moves.endRound();

          // Deal new bills if the game should continue
          if (this.props.round !== MAX_ROUNDS) {
            this.props.moves.dealBills();
          }
        }
      }
    }
  }

  isActive(die) {
    if (this.props.G.round === MAX_ROUNDS) return false;
    if (this.props.ctx.winner !== null) return false;
    if (this.props.G.roll[die] === 0) return false;
    return true;
  }

  render() {
    let winner = '';
    if (this.props.ctx.winner !== null) {
      winner = <div>Winner: {this.props.ctx.winner}</div>;
    }

    let dice = [];
    for (let i = 0; i < 6; i++) {
      let playerDice = [];
      for (let j = 0; j < this.props.ctx.numPlayers; j++) {
        playerDice.push(<li key={"die" + i + "player" + j}>{this.props.G.dice[i][j]}</li>);
      }

      dice.push(
        <div key={"die" + i} style={{float: 'left', padding: '1em'}}>
          <strong>{i + 1}</strong>: {this.props.G.bills[i].join(', ')}
          <ul>{playerDice}</ul>
        </div>
      );
    }

    let roll = [];
    if (this.props.G.roll) {
      // Create an array with one element for each die in random order
      let rollDice = [];
      for (let i = 0; i < this.props.G.roll.length; i++) {
        rollDice = rollDice.concat(Array(this.props.G.roll[i]).fill(i));
      }
      rollDice = shuffle(rollDice);

      roll = map(rollDice, (d, i) => <div key={"roll" + i}
                                          onClick={() => this.onClick(d)}>
                                       {DICE[d]}
                                     </div>)
    } else if (!this.props.G.round !== MAX_ROUNDS) {
      roll = <button onClick={() => this.props.moves.rollDice()}>Roll</button>
    }

    return <div>
      <h1>Round {this.props.G.round === MAX_ROUNDS ? MAX_ROUNDS : this.props.G.round + 1}</h1>
      <div>Player {this.props.ctx.currentPlayer}</div>
      <div>{dice}</div>
      <div style={{fontSize: '2em'}}>{roll}</div>
      {winner}
    </div>;
  }
}

const App = Client({
  board: LasVegasBoard,
  game: LasVegas
});

export default App;
